// === main.js ===
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const doricoFixer = require("./dorico_ss_fix_lib.js");

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 850,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // ← اضافه شد برای جلوگیری از اجرای preload در محیط sandbox
    },
  });

  win.loadFile("index.html");
  //   win.webContents.openDevTools(); // اختیاری، برای دیباگ
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// برای خروج در سیستم‌عامل‌های غیر مک
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// هندل کردن انتخاب مسیر خروجی
ipcMain.handle("select-output-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// هندل کردن پردازش فایل‌ها
ipcMain.handle("process-files", async (event, files, outputPath) => {
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const fixed = doricoFixer.fix(content);
    const fileName = path.basename(file);
    const outPath = path.join(outputPath, fileName);
    fs.writeFileSync(outPath, fixed, "utf-8");
  }
});

// //Closing web tools
// win.webContents.on("devtools-opened", () => {
//   win.webContents.closeDevTools();
// });

// win.removeMenu(); // Removes right-click menu (on Windows)
