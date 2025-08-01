// === main.js ===
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const doricoFixer = require("./dorico_ss_fix_lib.js");

function loadJSON(filename) {
  // Primary: inside asar/app bundle
  const inAsar = path.join(__dirname, "build", filename);
  if (fs.existsSync(inAsar)) {
    return require(inAsar);
  }

  // Fallback: if you unpacked the build folder (e.g., using extraResources)
  // resourcesPath points to e.g. ".../YourApp/resources"
  const { app } = require("electron");
  const resourceBase = process.resourcesPath;

  // If you used extraResources, they appear alongside the asar, not inside it.
  const external = path.join(resourceBase, "build", filename);
  if (fs.existsSync(external)) {
    return JSON.parse(fs.readFileSync(external, "utf-8"));
  }

  throw new Error(`Could not find ${filename} in expected locations.`);
}
const default_instrument_names = loadJSON("instrument_names.json");
const default_options = loadJSON("default_options.json");

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
  let logText = "";
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const [fixed, itemLogText] = await doricoFixer.fix(
      content,
      default_options,
      default_instrument_names
    );
    const fileName = path.basename(file);
    const outPath = path.join(outputPath, fileName);
    fs.writeFileSync(outPath, fixed, "utf-8");

    // Log the changes
    logText += `File: ${fileName}\n`;
    logText += itemLogText ? itemLogText + "\n" : "No changes\n";
  }
  fs.writeFileSync(path.join(outputPath, "log.txt"), logText, "utf-8");

  // Wait 1 second before opening the output folder
  await new Promise((resolve) => setTimeout(resolve, 1000));
  shell.openPath(outputPath);
});

// //Closing web tools
// win.webContents.on("devtools-opened", () => {
//   win.webContents.closeDevTools();
// });

// win.removeMenu(); // Removes right-click menu (on Windows)
