export function createSSEParser(onEvent: (event: string, data: string[]) => void) {
  let buffer = "";
  const decoder = new TextDecoder();

  const processBlock = (block: string) => {
    const lines = block.split("\n");
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim().replace(/^ +| +$/g, "");
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
      else if (line.trim() === "" || line.startsWith(":")) continue; // keepalive/comment
    }
    if (dataLines.length > 0) onEvent(event, dataLines);
  };

  return {
    feed(chunk: Uint8Array, flush = false) {
      buffer += decoder.decode(chunk, { stream: !flush });
      if (flush) {
        if (buffer.trim() !== "") processBlock(buffer);
        buffer = "";
        return;
      }
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const block of parts) {
        if (block.trim() !== "") processBlock(block);
      }
    },
  };
}
