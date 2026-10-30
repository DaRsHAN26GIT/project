export function downloadText(
  text: string,
  name: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function printText(text: string, title: string) {
  const popup = window.open("", "_blank");
  if (!popup) throw Error("Allow pop-ups to open the printable brief.");
  popup.opener = null;
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  popup.document.write(
    `<html lang="en"><head><title>${escape(title)}</title><style>body{margin:40px;font:15px/1.8 Arial;color:#183c32}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}@page{margin:16mm}</style></head><body><pre>${escape(text)}</pre></body></html>`,
  );
  popup.document.close();
  popup.focus();
  popup.print();
}
