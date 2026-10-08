"""Deterministic, limited source checks. These are not a comprehensive audit."""
import ast
import re
from collections import Counter

SECRET_RULES = [
    ('GitHub token', re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b')),
    ('AWS access key', re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b')),
    ('Private key', re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
]


def security_report(files):
    findings = []
    def add(f, line, severity, title, cwe, remediation, evidence):
        findings.append({'severity': severity, 'title': title, 'description': title,
                         'file': f['file_path'], 'line': line, 'cwe': cwe,
                         'remediation': remediation, 'evidence': evidence,
                         'why_it_matters': 'Review this source location before deploying.',
                         'source': 'deterministic-source-rule'})
    for f in files:
        content = f.get('code_content', '')
        for line, text in enumerate(content.splitlines(), 1):
            for title, pattern in SECRET_RULES:
                if pattern.search(text):
                    add(f, line, 'Critical', title + ' in source', 'CWE-798',
                        'Revoke the credential and move configuration to a secret store.', '[REDACTED]')
        if f.get('language') != 'python':
            continue
        try:
            tree = ast.parse(content)
        except SyntaxError:
            continue
        aliases = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    aliases[alias.asname or alias.name] = alias.name
            elif isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    aliases[alias.asname or alias.name] = f'{node.module}.{alias.name}'
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = ast.unparse(node.func)
            head, *tail = name.split('.')
            name = '.'.join([aliases.get(head, head), *tail])
            if name in ('eval', 'exec', 'pickle.loads', 'pickle.load'):
                add(f, node.lineno, 'High', 'Dynamic execution or unsafe deserialization', 'CWE-502',
                    'Ensure input is trusted; prefer structured parsing without execution.', name + '(...)')
            if name in ('subprocess.run', 'subprocess.call', 'subprocess.Popen', 'subprocess.check_output'):
                if any(k.arg == 'shell' and isinstance(k.value, ast.Constant) and k.value.value is True for k in node.keywords):
                    add(f, node.lineno, 'High', 'Shell execution enabled', 'CWE-78',
                        'Pass an argument list with shell=False and validate inputs.', 'shell=True')
            if name in ('requests.get', 'requests.post', 'httpx.get', 'httpx.post'):
                if any(k.arg == 'verify' and isinstance(k.value, ast.Constant) and k.value.value is False for k in node.keywords):
                    add(f, node.lineno, 'Medium', 'TLS certificate verification disabled', 'CWE-295',
                        'Enable certificate verification.', 'verify=False')
    penalties = {'Critical': 25, 'High': 12, 'Medium': 5, 'Low': 1}
    return {'security_score': max(0, 100 - sum(penalties[f['severity']] for f in findings)),
            'vulnerabilities': findings,
            'scope': 'Secret signatures and Python AST rules only; dependency vulnerabilities and other languages are not audited.'}


def health_report(files, graph):
    if not files:
        return {'summary': {}, 'health': {'architecture_score': None, 'security_score': None,
                    'maintainability_score': None, 'testing_score': None, 'performance_score': None,
                    'overall_score': None, 'breakdown': {'status': 'unavailable', 'metrics': {}}},
                'tech_debt': {'debt_score': None, 'critical_count': 0, 'major_count': 0, 'minor_count': 0, 'issues': []}}
    issues = []
    total_lines = sum(len(f.get('code_content', '').splitlines()) for f in files)
    test_files = sum(bool(re.search(r'(^|/)(tests?|__tests__)(/|$)|(^|/)(test_|.*[._]test\.)|_test\.', f['file_path'])) for f in files)
    for f in files:
        lines = len(f.get('code_content', '').splitlines())
        if lines > 500:
            issues.append({'severity': 'major', 'file': f['file_path'], 'line': 1,
                           'type': 'Large File', 'description': f'File contains {lines} lines (threshold: 500).',
                           'impact': 'Large modules are harder to review and maintain.',
                           'recommendation': 'Extract cohesive responsibilities where appropriate.'})
    cycles = graph.get('cycles', [])
    for cycle in cycles:
        issues.append({'severity': 'major', 'file': cycle[0], 'line': None,
                       'type': 'Circular Dependency', 'description': ' → '.join(cycle),
                       'impact': 'Cyclic imports increase coupling and initialization risk.',
                       'recommendation': 'Review shared dependencies and break the import cycle.'})
    architecture = max(0, 100 - len(cycles) * 10)
    maintainability = max(0, 100 - sum(i['type'] == 'Large File' for i in issues) * 5)
    security = security_report(files)['security_score']
    overall = round((architecture + maintainability + security) / 3)
    return {'summary': {'tech_stack': sorted({f['language'] for f in files})},
            'health': {'overall_score': overall, 'architecture_score': architecture,
                       'security_score': security, 'maintainability_score': maintainability,
                       'testing_score': None, 'performance_score': None,
                       'breakdown': {'status': 'partial', 'confidence': 'limited',
                         'metrics': {'files': len(files), 'lines': total_lines, 'test_files': test_files,
                                     'cycles': len(cycles), 'large_files': sum(i['type'] == 'Large File' for i in issues)},
                         'method': 'Mean of source-rule security, cycle penalty, and file-size penalty. Test coverage and runtime performance are not measured.',
                         'architecture': 'Import cycles: 10-point penalty per cycle.',
                         'security': 'Source rule penalties: Critical 25, High 12, Medium 5, Low 1.',
                         'maintainability': '5-point penalty per file exceeding 500 lines.',
                         'testing': 'Coverage unavailable. Test file count is descriptive only.',
                         'performance': 'Runtime performance not measured.'}},
            'tech_debt': {'debt_score': maintainability,
                          'critical_count': 0, 'major_count': len(issues), 'minor_count': 0,
                          'issues': issues}}
