import { app, BrowserWindow, Menu, shell, dialog } from "electron";
import { initGlobalCfg, validateGlobalCfgFile, setMustOpenForm } from "./config";
import { initWalletCfg, getWalletCfg, newWalletConfigCreation, readcdrConfig, createTempcdrConf } from "./config";
import fs from "fs-extra";
import path from "path";
import parseArgs from "minimist";
import { appLocaleFromElectronLocale, default as locales } from "./i18n/locales";
import { createLogger, lastLogLine, GetcdrLogs, GetcdrwalletLogs } from "./main_dev/logging";
import { OPTIONS, USAGE_MESSAGE, VERSION_MESSAGE, BOTH_CONNECTION_ERR_MESSAGE } from "./main_dev/constants";
import { appDataDirectory, getcdrPath, cdrctlCfg, cdrCfg, getcdrwalletPath } from "./main_dev/paths";
import { getWalletPath, getExecutablePath, getWalletsDirectoryPath, getWalletsDirectoryPathNetwork } from "./main_dev/paths";
import { getGlobalCfgPath, getWalletDBPathFromWallets, getcdrRpcCert, getDirectoryLogs, checkAndInitWalletCfg } from "./main_dev/paths";
import { installSessionHandlers, reloadAllowedExternalRequests, allowStakepoolRequests } from "./main_dev/externalRequests";
import { setupProxy } from "./main_dev/proxy";
import { cleanShutdown, launchcdr, launchcdrWallet, closecdrW, GetcdrwPort } from "./main_dev/launch";

// setPath as commanderuiton
app.setPath("userData", appDataDirectory());

const argv = parseArgs(process.argv.slice(1), OPTIONS);
const debug = argv.debug || process.env.NODE_ENV === "development";
const logger = createLogger(debug);

// Verify that config.json is valid JSON before fetching it, because
// it will silently fail when fetching.
let err = validateGlobalCfgFile();
if (err !== null) {
  let errMessage = "There was an error while trying to load the config file, the format is invalid.\n\nFile: " + getGlobalCfgPath() + "\nError: " + err;
  dialog.showErrorBox("Config File Error", errMessage);
  app.quit();
}

let menu;
let template;
let mainWindow = null;
let versionWin = null;
let grpcVersions = { requiredVersion: null, walletVersion: null };
let cdrPID;
let cdrwPID;
let previousWallet = null;
let cdrConfig = {};
let currentBlockCount;
let primaryInstance;

const globalCfg = initGlobalCfg();
const daemonIsAdvanced = globalCfg.get("daemon_start_advanced");
const walletsDirectory = getWalletsDirectoryPath();
const mainnetWalletsPath = getWalletsDirectoryPathNetwork(false);
const testnetWalletsPath = getWalletsDirectoryPathNetwork(true);

if (argv.help) {
  console.log(USAGE_MESSAGE);
  app.exit(0);
}

if (argv.version) {
  console.log(VERSION_MESSAGE);
  app.exit(0);
}

// Check if network was set on command line (but only allow one!).
if (argv.testnet && argv.mainnet) {
  logger.log(BOTH_CONNECTION_ERR_MESSAGE);
  app.quit();
}

if (process.env.NODE_ENV === "production") {
  const sourceMapSupport = require('source-map-support'); // eslint-disable-line
  sourceMapSupport.install();
}

if (process.env.NODE_ENV === "development") {
  const path = require('path'); // eslint-disable-line
  const p = path.join(__dirname, '..', 'app', 'node_modules'); // eslint-disable-line
  require('module').globalPaths.push(p); // eslint-disable-line
}

// Check that wallets directory has been created, if not, make it.
fs.pathExistsSync(walletsDirectory) || fs.mkdirsSync(walletsDirectory);
fs.pathExistsSync(mainnetWalletsPath) || fs.mkdirsSync(mainnetWalletsPath);
fs.pathExistsSync(testnetWalletsPath) || fs.mkdirsSync(testnetWalletsPath);

checkAndInitWalletCfg(true);
checkAndInitWalletCfg(false);

logger.log("info", "Using config/data from:" + app.getPath("userData"));
logger.log("info", "Versions: commanderuiton: %s, Electron: %s, Chrome: %s",
  app.getVersion(), process.versions.electron, process.versions.chrome);

process.on("uncaughtException", err => {
  logger.log("error", "UNCAUGHT EXCEPTION", err);
  throw err;
});

const installExtensions = async () => {
  if (process.env.NODE_ENV === "development") {
    const installer = require("electron-devtools-installer"); // eslint-disable-line global-require

    const extensions = [
      "REACT_DEVELOPER_TOOLS",
      "REDUX_DEVTOOLS"
    ];
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    for (const name of extensions) { // eslint-disable-line
      try {
        await installer.default(installer[name], forceDownload);
      } catch (e) { } // eslint-disable-line
    }
  }
};

const { ipcMain } = require("electron");

ipcMain.on("reload-allowed-external-request", (event) => {
  reloadAllowedExternalRequests();
  event.returnValue = true;
});
ipcMain.on("allow-stakepool-host", (event, host) => {
  allowStakepoolRequests(host);
  event.returnValue = true;
});

ipcMain.on("setup-proxy", () => {
  setupProxy(logger);
});

ipcMain.on("get-available-wallets", (event, network) => {// Attempt to find all currently available wallet.db's in the respective network direction in each wallets data dir
  const availableWallets = [];
  const isTestNet = network !== "mainnet";

  const walletsBasePath = getWalletPath(isTestNet);
  const walletDirs = fs.readdirSync(walletsBasePath);
  walletDirs.forEach(wallet => {
    const walletDirStat = fs.statSync(path.join(walletsBasePath, wallet));
    if (!walletDirStat.isDirectory()) return;

    const walletDbFilePath = getWalletDBPathFromWallets(isTestNet, wallet);
    const finished = fs.pathExistsSync(walletDbFilePath);
    availableWallets.push({ network, wallet, finished });
  });

  event.returnValue = availableWallets;
});

ipcMain.on("start-daemon", (event, appData, testnet) => {
  if (cdrPID && cdrConfig && !daemonIsAdvanced) {
    logger.log("info", "Skipping restart of daemon as it is already running");
    event.returnValue = cdrConfig;
    return;
  }
  if(appData){
    logger.log("info", "launching cdr with different appdata directory");
  }
  if (cdrPID && cdrConfig) {
    logger.log("info", "cdr already started " + cdrPID);
    event.returnValue = cdrConfig;
    return;
  }
  if (!daemonIsAdvanced && !primaryInstance) {
    logger.log("info", "Running on secondary instance. Assuming cdr is already running.");
    let cdrConfPath = getcdrPath();
    if (!fs.existsSync(cdrCfg(cdrConfPath))) {
      cdrConfPath = createTempcdrConf();
    }
    cdrConfig = readcdrConfig(cdrConfPath, testnet);
    cdrConfig.rpc_cert = getcdrRpcCert();
    cdrConfig.pid = -1;
    event.returnValue = cdrConfig;
    return;
  }
  try {
    let cdrConfPath = getcdrPath();
    if (!fs.existsSync(cdrCfg(cdrConfPath))) {
      cdrConfPath = createTempcdrConf();
    }
    cdrConfig = launchcdr(mainWindow, daemonIsAdvanced, cdrConfPath, appData, testnet);
    cdrPID = cdrConfig.pid;
  } catch (e) {
    logger.log("error", "error launching cdr: " + e);
  }
  event.returnValue = cdrConfig;
});

ipcMain.on("create-wallet", (event, walletPath, testnet) => {
  let newWalletDirectory = getWalletPath(testnet, walletPath);
  if (!fs.pathExistsSync(newWalletDirectory)){
    fs.mkdirsSync(newWalletDirectory);

    // create new configs for new wallet
    initWalletCfg(testnet, walletPath);
    newWalletConfigCreation(testnet, walletPath);
  }
  event.returnValue = true;
});

ipcMain.on("remove-wallet", (event, walletPath, testnet) => {
  let removeWalletDirectory = getWalletPath(testnet, walletPath);
  if (fs.pathExistsSync(removeWalletDirectory)){
    fs.removeSync(removeWalletDirectory);
  }
  event.returnValue = true;
});

ipcMain.on("stop-wallet", (event) => {
  closecdrW(cdrwPID);
  event.returnValue = true;
});

ipcMain.on("start-wallet", (event, walletPath, testnet) => {
  if (cdrwPID) {
    logger.log("info", "cdrwallet already started " + cdrwPID);
    mainWindow.webContents.send("cdrwallet-port", GetcdrwPort());
    event.returnValue = cdrwPID;
    return;
  }
  initWalletCfg(testnet, walletPath);
  try {
    cdrwPID = launchcdrWallet(mainWindow, daemonIsAdvanced, walletPath, testnet);
  } catch (e) {
    logger.log("error", "error launching cdrwallet: " + e);
  }
  event.returnValue = getWalletCfg(testnet, walletPath);
});

ipcMain.on("check-daemon", (event, rpcCreds, testnet) => {
  let args = [ "getblockcount" ];
  let host, port;
  if (!rpcCreds){
    args.push(`--configfile=${cdrctlCfg(appDataDirectory())}`);
  } else if (rpcCreds) {
    if (rpcCreds.rpc_user) {
      args.push(`--rpcuser=${rpcCreds.rpc_user}`);
    }
    if (rpcCreds.rpc_password) {
      args.push(`--rpcpass=${rpcCreds.rpc_password}`);
    }
    if (rpcCreds.rpc_cert) {
      args.push(`--rpccert=${rpcCreds.rpc_cert}`);
    }
    if (rpcCreds.rpc_host) {
      host = rpcCreds.rpc_host;
    }
    if (rpcCreds.rpc_port) {
      port = rpcCreds.rpc_port;
    }
    args.push("--rpcserver=" + host + ":" + port);
  }

  if (testnet) {
    args.push("--testnet");
  }

  var cdrctlExe = getExecutablePath("cdrctl", argv.customBinPath);
  if (!fs.existsSync(cdrctlExe)) {
    logger.log("error", "The cdrctl file does not exists");
  }

  logger.log("info", `checking if daemon is ready  with cdrctl ${args}`);

  var spawn = require("child_process").spawn;
  var cdrctl = spawn(cdrctlExe, args, { detached: false, stdio: [ "ignore", "pipe", "pipe", "pipe" ] });

  cdrctl.stdout.on("data", (data) => {
    currentBlockCount = data.toString();
    logger.log("info", data.toString());
    mainWindow.webContents.send("check-daemon-response", currentBlockCount);
  });
  cdrctl.stderr.on("data", (data) => {
    logger.log("error", data.toString());
    mainWindow.webContents.send("check-daemon-response", 0);
  });
});

ipcMain.on("clean-shutdown", async function(event){
  const stopped = await cleanShutdown(mainWindow, app, cdrPID, cdrwPID);
  event.sender.send("clean-shutdown-finished", stopped);
});

ipcMain.on("app-reload-ui", () => {
  mainWindow.reload();
});

ipcMain.on("grpc-versions-determined", (event, versions) => {
  grpcVersions = { ...grpcVersions, ...versions };
});

ipcMain.on("main-log", (event, ...args) => {
  logger.log(...args);
});

ipcMain.on("get-cdr-logs", (event) => {
  event.returnValue = GetcdrLogs();
});

ipcMain.on("get-cdrwallet-logs", (event) => {
  event.returnValue = GetcdrwalletLogs();
});

ipcMain.on("get-commanderuiton-logs", (event) => {
  event.returnValue = "commanderuiton logs!";
});

ipcMain.on("get-last-log-line-cdr", event => {
  event.returnValue = lastLogLine(GetcdrLogs());
});

ipcMain.on("get-last-log-line-cdrwallet", event => {
  event.returnValue = lastLogLine(GetcdrwalletLogs());
});

ipcMain.on("get-previous-wallet", (event) => {
  event.returnValue = previousWallet;
});

ipcMain.on("set-previous-wallet", (event, cfg) => {
  previousWallet = cfg;
  event.returnValue = true;
});

const readExesVersion = () => {
  let spawn = require("child_process").spawnSync;
  let args = [ "--version" ];
  let exes = [ "cdr", "cdrwallet", "cdrctl" ];
  let versions = {
    grpc: grpcVersions,
    commanderuiton: app.getVersion()
  };

  for (let exe of exes) {
    let exePath = getExecutablePath("cdr", argv.customBinPath);
    if (!fs.existsSync(exePath)) {
      logger.log("error", "The cdr file does not exists");
    }

    let proc = spawn(exePath, args, { encoding: "utf8" });
    if (proc.error) {
      logger.log("error", `Error trying to read version of ${exe}: ${proc.error}`);
      continue;
    }

    let versionLine = proc.stdout.toString();
    if (!versionLine) {
      logger.log("error", `Empty version line when reading version of ${exe}`);
      continue;
    }

    let decodedLine = versionLine.match(/\w+ version ([^\s]+)/);
    if (decodedLine !== null) {
      versions[exe] = decodedLine[1];
    } else {
      logger.log("error", `Unable to decode version line ${versionLine}`);
    }
  }

  return versions;
};

primaryInstance = !app.makeSingleInstance(() => true);
const stopSecondInstance = !primaryInstance && !daemonIsAdvanced;
if (stopSecondInstance) {
  logger.log("error", "Preventing second instance from running.");
}

app.on("ready", async () => {

  // when installing (on first run) locale will be empty. Determine the user's
  // OS locale and set that as commanderuiton's locale.
  let cfgLocale = globalCfg.get("locale", "");
  let locale = locales.find(value => value.key === cfgLocale);
  if (!locale) {
    let newCfgLocale = appLocaleFromElectronLocale(app.getLocale());
    logger.log("error", `Locale ${cfgLocale} not found. Switching to locale ${newCfgLocale}.`);
    globalCfg.set("locale", newCfgLocale);
    locale = locales.find(value => value.key === newCfgLocale);
  }

  let windowOpts = { show: false, width: 1178, height: 790, page: "app.html" };
  if (stopSecondInstance) {
    windowOpts = { show: true, width: 575, height: 275, autoHideMenuBar: true,
      resizable: false, page: "staticPages/secondInstance.html" };
  } else {
    await installExtensions();
    await setupProxy(logger);
  }
  windowOpts.title = "commanderuiton - " + app.getVersion();

  mainWindow = new BrowserWindow(windowOpts);
  installSessionHandlers(logger);
  mainWindow.loadURL(`file://${__dirname}/${windowOpts.page}`);

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (versionWin !== null) {
      versionWin.close();
    }
    if (stopSecondInstance) {
      app.quit();
      setTimeout(() => { app.quit(); }, 2000);
    }
  });

  if (process.env.NODE_ENV === "development") mainWindow.openDevTools();
  if (stopSecondInstance) return;

  mainWindow.webContents.on("context-menu", (e, props) => {
    const { selectionText, isEditable, x, y } = props;
    let inputMenu = [
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectall" }
    ];
    let selectionMenu = [
      { role: "copy" },
      { type: "separator" },
      { role: "selectall" }
    ];
    if (process.env.NODE_ENV === "development") {
      let inspectElement = {
        label: "Inspect element",
        click: () => mainWindow.inspectElement(x, y)
      };
      inputMenu.push(inspectElement);
      selectionMenu.push(inspectElement);
    }
    if (isEditable) {
      Menu.buildFromTemplate(inputMenu).popup(mainWindow);
    } else if (selectionText && selectionText.trim() !== "") {
      Menu.buildFromTemplate(selectionMenu).popup(mainWindow);
    } else if (process.env.NODE_ENV === "development") {
      Menu.buildFromTemplate([ {
        label: "Inspect element",
        click: () => mainWindow.inspectElement(x, y)
      } ]).popup(mainWindow);
    }
  });

  if (process.platform === "darwin") {
    template = [ {
      label: locale.messages["appMenu.commanderuiton"],
      submenu: [ {
        label: locale.messages["appMenu.aboutcommanderuiton"],
        selector: "orderFrontStandardAboutPanel:"
      }, {
        type: "separator"
      }, {
        label: locale.messages["appMenu.services"],
        submenu: []
      }, {
        type: "separator"
      }, {
        label: locale.messages["appMenu.hidecommanderuiton"],
        accelerator: "Command+H",
        selector: "hide:"
      }, {
        label: locale.messages["appMenu.hideOthers"],
        accelerator: "Command+Shift+H",
        selector: "hideOtherApplications:"
      }, {
        label: locale.messages["appMenu.showAll"],
        selector: "unhideAllApplications:"
      }, {
        type: "separator"
      }, {
        label: locale.messages["appMenu.quit"],
        accelerator: "Command+Q",
        click() {
          cleanShutdown(mainWindow, app, cdrPID, cdrwPID);
        }
      } ]
    }, {
      label: locale.messages["appMenu.edit"],
      submenu: [ {
        label: locale.messages["appMenu.undo"],
        accelerator: "Command+Z",
        selector: "undo:"
      }, {
        label: locale.messages["appMenu.redo"],
        accelerator: "Shift+Command+Z",
        selector: "redo:"
      }, {
        type: "separator"
      }, {
        label: locale.messages["appMenu.cut"],
        accelerator: "Command+X",
        selector: "cut:"
      }, {
        label: locale.messages["appMenu.copy"],
        accelerator: "Command+C",
        selector: "copy:"
      }, {
        label: locale.messages["appMenu.paste"],
        accelerator: "Command+V",
        selector: "paste:"
      }, {
        label: locale.messages["appMenu.selectAll"],
        accelerator: "Command+A",
        selector: "selectAll:"
      } ]
    }, {
      label: locale.messages["appMenu.view"],
      submenu: [ {
        label: "Toggle Full Screen",
        accelerator: "Ctrl+Command+F",
        click() {
          mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
      } ]
    }, {
      label: locale.messages["appMenu.window"],
      submenu: [ {
        label: locale.messages["appMenu.minimize"],
        accelerator: "Command+M",
        selector: "performMiniaturize:"
      }, {
        label: locale.messages["appMenu.close"],
        accelerator: "Command+W",
        selector: "performClose:"
      }, {
        type: "separator"
      }, {
        label: locale.messages["appMenu.bringAllFront"],
        selector: "arrangeInFront:"
      } ]
    } ];
  } else {
    template = [ {
      label: locale.messages["appMenu.file"],
      submenu: [ {
        label: "&Close",
        accelerator: "Ctrl+W",
        click() {
          mainWindow.close();
        }
      } ]
    }, {
      label: locale.messages["appMenu.view"],
      submenu: [ {
        label: locale.messages["appMenu.toggleFullScreen"],
        accelerator: "F11",
        click() {
          mainWindow.setFullScreen(!mainWindow.isFullScreen());
        },
      }, {
        label: locale.messages["appMenu.reloadUI"],
        accelerator: "F5",
        click() {
          mainWindow.webContents.send("app-reload-requested", mainWindow);
        },
      } ]
    } ];
  }
  template.push(
    {
      label: locale.messages["appMenu.advanced"],
      submenu: [ {
        label: locale.messages["appMenu.developerTools"],
        accelerator: "Alt+Ctrl+I",
        click() {
          mainWindow.toggleDevTools();
        }
      }, {
        label: locale.messages["appMenu.showWalletLog"],
        click() {
          shell.openItem(getDirectoryLogs(getcdrwalletPath()));
        }
      }, {
        label: locale.messages["appMenu.showDaemonLog"],
        click() {
          shell.openItem(getDirectoryLogs(getcdrPath()));
        }
      } ]
    }, {
      label: locale.messages["appMenu.help"],
      submenu: [ {
        label: locale.messages["appMenu.learnMore"],
        click() {
          shell.openExternal("https://commanderu.org");
        }
      }, {
        label: locale.messages["appMenu.documentation"],
        click() {
          shell.openExternal("https://github.com/commanderu/commanderuiton");
        }
      }, {
        label: locale.messages["appMenu.communityDiscussions"],
        click() {
          shell.openExternal("https://forum.commanderu.org");
        }
      }, {
        label: locale.messages["appMenu.searchIssues"],
        click() {
          shell.openExternal("https://github.com/commanderu/commanderuiton/issues");
        }
      }, {
        label: locale.messages["appMenu.about"],
        click() {
          if (!versionWin) {
            versionWin = new BrowserWindow({ width: 575, height: 325, show: false, autoHideMenuBar: true, resizable: false });
            versionWin.on("closed", () => {
              versionWin = null;
            });

            // Load a remote URL
            versionWin.loadURL(`file://${__dirname}/staticPages/version.html`);

            versionWin.once("ready-to-show", () => {
              versionWin.webContents.send("exes-versions", readExesVersion());
              versionWin.show();
            });
          }
        }
      } ]
    });
  menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

app.on("before-quit", (event) => {
  logger.log("info","Caught before-quit. Set commanderuition as was closed");
  event.preventDefault();
  cleanShutdown(mainWindow, app, cdrPID, cdrwPID);
  setMustOpenForm(true);
  app.exit(0);
});
