import { RustVisibility } from "../../symbols/rust.js";

export function renderVisibility(visibility?: RustVisibility): string {
  if (!visibility || visibility === "private") {
    return "";
  }
  if (typeof visibility === "object" && "pubIn" in visibility) {
    return `pub(in ${visibility.pubIn}) `;
  }
  return visibility + " ";
}
