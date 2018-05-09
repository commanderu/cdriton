
let ipcRenderer = require("electron").ipcRenderer;
ipcRenderer.on("exes-versions", function (event, versions) {
  document.getElementById("commanderuitonVersion").innerHTML = versions["commanderuiton"];
  document.getElementById("cdrVersion").innerHTML = versions["cdr"];
  document.getElementById("cdrwalletVersion").innerHTML = versions["cdrwallet"];
  document.getElementById("walletGrpcVersion").innerHTML = versions["grpc"]["walletVersion"];
  document.getElementById("requiredWalletGrpcVersion").innerHTML = versions["grpc"]["requiredVersion"];
  document.getElementById("whatsNewLink").href =
    `https://github.com/commanderu/commanderu-binaries/releases/tag/v${versions["commanderuiton"]}`;
});
