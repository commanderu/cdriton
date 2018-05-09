import { FormattedMessage as T } from "react-intl";
import "style/Logs.less";

const Logs = ({
  showcdrLogs,
  showcdrwalletLogs,
  hidecdrLogs,
  hidecdrwalletLogs,
  cdrLogs,
  cdrwalletLogs,
  isDaemonRemote,
  isDaemonStarted,
  walletReady,
}
) => (
  <Aux>
    {!isDaemonRemote && isDaemonStarted ?
      !cdrLogs ?
        <div className="log-area hidden">
          <div className="log-area-title hidden" onClick={showcdrLogs}>
            <T id="help.logs.cdr" m="cdr" />
          </div>
        </div>:
        <div className="log-area expanded">
          <div className="log-area-title expanded" onClick={hidecdrLogs}>
            <T id="help.logs.cdr" m="cdr" />
          </div>
          <div className="log-area-logs">
            <textarea rows="30" value={cdrLogs} disabled />
          </div>
        </div> :
      <div/>
    }
    {!walletReady ? null : !cdrwalletLogs ?
      <div className="log-area hidden">
        <div className="log-area-title hidden" onClick={showcdrwalletLogs}>
          <T id="help.logs.cdrwallet" m="cdrwallet" />
        </div>
      </div>:
      <div className="log-area expanded">
        <div className="log-area-title expanded" onClick={hidecdrwalletLogs}>
          <T id="help.logs.cdrwallet" m="cdrwallet" />
        </div>
        <div className="log-area-logs">
          <textarea rows="30" value={cdrwalletLogs} disabled />
        </div>
      </div>
    }
  </Aux>
);

export default Logs;
