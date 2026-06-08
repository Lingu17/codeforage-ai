-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Table to store scanned repositories
create table if not exists repositories (
  id uuid primary key default gen_random_uuid(),
  github_id bigint unique not null,
  name text not null,
  display_name text, -- Custom display name
  full_name text not null,
  description text,
  language text,
  owner_username text not null,
  user_id uuid, -- Associated Supabase User ID (optional reference to auth.users)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table to track repository scan jobs
create table if not exists repository_scans (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id) on delete cascade not null,
  status text not null default 'queued', -- 'queued', 'scanning', 'embedding', 'analyzing', 'completed', 'failed'
  progress integer not null default 0,
  current_step text not null default 'Queued',
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  error_message text
);

-- Table to store extracted code files and their structural metadata (No full code content stored)
create table if not exists repository_files (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id) on delete cascade not null,
  file_path text not null,
  language text not null,
  size bigint not null default 0,
  hash text,
  classes text[] default '{}',
  functions text[] default '{}',
  imports text[] default '{}',
  exports text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (repository_id, file_path)
);

-- Table to store document chunks and embeddings for RAG
create table if not exists code_chunks (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id) on delete cascade not null,
  file_id uuid references repository_files(id) on delete cascade,
  file_path text not null,
  chunk_index integer not null,
  chunk_text text not null,
  embedding vector(768) not null,
  language text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table to store embeddings separately
create table if not exists embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid references code_chunks(id) on delete cascade not null,
  embedding vector(768) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger to automatically populate embeddings table from code_chunks
create or replace function replicate_code_chunk_embedding()
returns trigger as $$
begin
  insert into embeddings (chunk_id, embedding, created_at)
  values (new.id, new.embedding, new.created_at);
  return new;
end;
$$ language plpgsql;

create or replace trigger replicate_chunk_embedding_trigger
after insert on code_chunks
for each row
execute function replicate_code_chunk_embedding();


-- Table to store architecture reports
create table if not exists architecture_reports (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id) on delete cascade not null,
  graph_data jsonb not null, -- { "nodes": [...], "edges": [...] }
  summary text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table to store technical debt reports
create table if not exists technical_debt_reports (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id) on delete cascade not null,
  debt_score integer not null, -- 0 to 100
  critical_count integer not null default 0,
  major_count integer not null default 0,
  minor_count integer not null default 0,
  issues jsonb not null default '[]', -- List of items with code issues
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table to store security reports
create table if not exists security_reports (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id) on delete cascade not null,
  security_score integer not null, -- 0 to 100
  vulnerabilities jsonb not null default '[]', -- [{ "severity": "High", "file": "...", "line": 5, "description": "..." }]
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table to store overall engineering health scores
create table if not exists health_scores (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id) on delete cascade not null,
  overall_score integer not null, -- 0 to 100
  architecture_score integer not null,
  security_score integer not null,
  maintainability_score integer not null,
  testing_score integer not null,
  performance_score integer not null,
  breakdown jsonb not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Chat sessions
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id) on delete cascade not null,
  title text not null default 'New Conversation',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Chat messages with source citations
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade not null,
  role text not null, -- 'user' or 'assistant'
  content text not null,
  citations jsonb not null default '[]', -- Array of file paths used as source reference
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PR Reviews
create table if not exists pr_reviews (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id) on delete cascade,
  diff_content text not null,
  summary text not null,
  risk_level text not null, -- 'Low', 'Medium', 'High'
  recommendations jsonb not null default '[]',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create fast vector index
create index if not exists code_chunks_embedding_idx on code_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- RPC Function for pgvector cosine similarity matching
create or replace function match_code_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  repo_id uuid
)
returns table (
  id uuid,
  file_path text,
  chunk_index int,
  chunk_text text,
  similarity float
)
language sql stable
as $$
  select
    code_chunks.id,
    code_chunks.file_path,
    code_chunks.chunk_index,
    code_chunks.chunk_text,
    1 - (code_chunks.embedding <=> query_embedding) as similarity
  from code_chunks
  where code_chunks.repository_id = repo_id
    and 1 - (code_chunks.embedding <=> query_embedding) > match_threshold
  order by code_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- Enable Row Level Security (RLS) on all tables
alter table repositories enable row level security;
alter table repository_scans enable row level security;
alter table repository_files enable row level security;
alter table code_chunks enable row level security;
alter table embeddings enable row level security;
alter table architecture_reports enable row level security;
alter table technical_debt_reports enable row level security;
alter table security_reports enable row level security;
alter table health_scores enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table pr_reviews enable row level security;

-- Create Security Policies for Authenticated Users

-- Repositories: User can manage their own repositories
create policy "Authenticated users can manage repositories"
  on repositories for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Scan Jobs: User can manage scan jobs for their own repositories
create policy "Users can manage repository_scans for their repositories"
  on repository_scans for all to authenticated
  using (exists (select 1 from repositories where repositories.id = repository_scans.repository_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from repositories where repositories.id = repository_scans.repository_id and repositories.user_id = auth.uid()));

-- Code Files: User can manage code files for their own repositories
create policy "Users can manage repository_files for their repositories"
  on repository_files for all to authenticated
  using (exists (select 1 from repositories where repositories.id = repository_files.repository_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from repositories where repositories.id = repository_files.repository_id and repositories.user_id = auth.uid()));

-- Code Chunks: User can manage code chunks for their own repositories
create policy "Users can manage code_chunks for their repositories"
  on code_chunks for all to authenticated
  using (exists (select 1 from repositories where repositories.id = code_chunks.repository_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from repositories where repositories.id = code_chunks.repository_id and repositories.user_id = auth.uid()));

-- Embeddings: User can manage embeddings for their own repositories
create policy "Users can manage embeddings for their repositories"
  on embeddings for all to authenticated
  using (exists (select 1 from code_chunks join repositories on code_chunks.repository_id = repositories.id where code_chunks.id = embeddings.chunk_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from code_chunks join repositories on code_chunks.repository_id = repositories.id where code_chunks.id = embeddings.chunk_id and repositories.user_id = auth.uid()));

-- Architecture Reports: User can manage architecture reports for their own repositories
create policy "Users can manage architecture_reports for their repositories"
  on architecture_reports for all to authenticated
  using (exists (select 1 from repositories where repositories.id = architecture_reports.repository_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from repositories where repositories.id = architecture_reports.repository_id and repositories.user_id = auth.uid()));

-- Technical Debt Reports: User can manage technical debt reports for their own repositories
create policy "Users can manage technical_debt_reports for their repositories"
  on technical_debt_reports for all to authenticated
  using (exists (select 1 from repositories where repositories.id = technical_debt_reports.repository_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from repositories where repositories.id = technical_debt_reports.repository_id and repositories.user_id = auth.uid()));

-- Security Reports: User can manage security reports for their own repositories
create policy "Users can manage security_reports for their repositories"
  on security_reports for all to authenticated
  using (exists (select 1 from repositories where repositories.id = security_reports.repository_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from repositories where repositories.id = security_reports.repository_id and repositories.user_id = auth.uid()));

-- Health Scores: User can manage health scores for their own repositories
create policy "Users can manage health_scores for their repositories"
  on health_scores for all to authenticated
  using (exists (select 1 from repositories where repositories.id = health_scores.repository_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from repositories where repositories.id = health_scores.repository_id and repositories.user_id = auth.uid()));

-- Chat Sessions: User can manage chat sessions for their own repositories
create policy "Users can manage chat_sessions for their repositories"
  on chat_sessions for all to authenticated
  using (exists (select 1 from repositories where repositories.id = chat_sessions.repository_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from repositories where repositories.id = chat_sessions.repository_id and repositories.user_id = auth.uid()));

-- Chat Messages: User can manage chat messages for their own repositories
create policy "Users can manage chat_messages for their chat sessions"
  on chat_messages for all to authenticated
  using (exists (select 1 from chat_sessions join repositories on chat_sessions.repository_id = repositories.id where chat_sessions.id = chat_messages.session_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from chat_sessions join repositories on chat_sessions.repository_id = repositories.id where chat_sessions.id = chat_messages.session_id and repositories.user_id = auth.uid()));

-- PR Reviews: User can manage PR reviews for their own repositories
create policy "Users can manage pr_reviews for their repositories"
  on pr_reviews for all to authenticated
  using (exists (select 1 from repositories where repositories.id = pr_reviews.repository_id and repositories.user_id = auth.uid()))
  with check (exists (select 1 from repositories where repositories.id = pr_reviews.repository_id and repositories.user_id = auth.uid()));

-- Table to store contact form messages
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on contact_messages
alter table contact_messages enable row level security;

-- Policy: Allow anyone (unauthenticated/anon) to insert submissions
create policy "Anyone can submit contact messages"
  on contact_messages for insert to anon, authenticated
  with check (true);

