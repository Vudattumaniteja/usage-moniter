import fs from "fs";
import path from "path";

const iconsDir = path.join(process.cwd(), "src-tauri", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const buf = Buffer.from(pngBase64, "base64");

["32x32.png", "128x128.png", "128x128@2x.png", "icon.png", "icon.icns", "icon.ico"].forEach((f) => {
  fs.writeFileSync(path.join(iconsDir, f), buf);
});

console.log("Icons generated successfully");
