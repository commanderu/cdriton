import { KeyBlueButton } from "buttons";
import { ShowError } from "shared";
import { FormattedMessage as T } from "react-intl";
import { getcdrLastLogLine, getcdrwalletLastLogLine } from "wallet";
import ReactTimeout from "react-timeout";
import "style/GetStarted.less";

function parseLogLine(line) {
  const res = /^[\d :\-.]+ \[...\] (.+)$/.exec(line);
  return res ? res[1] : "";
}

const LastLogLinesFragment = ({ lastcdrLogLine, lastcdrwalletLogLine }) => (
  <div className="get-started-last-log-lines">
    <div className="last-cdr-log-line">{lastcdrLogLine}</div>
    <div className="last-cdrwallet-log-line">{lastcdrwalletLogLine}</div>
  </div>
);

const StartupErrorFragment = ({ onRetryStartRPC }) => (
  <div className="advanced-page-form">
    <div className="advanced-daemon-row">
      <ShowError className="get-started-error" error="Connection to cdr failed, please try and reconnect." />
    </div>
    <div className="loader-bar-buttons">
      <KeyBlueButton className="get-started-rpc-retry-button" onClick={onRetryStartRPC}>
        <T id="getStarted.retryBtn" m="Retry" />
      </KeyBlueButton>
    </div>
  </div>
);

@autobind
class StartRPCBody extends React.Component {

  constructor(props) {
    super(props);
    this.state = { lastcdrLogLine: "", lastcdrwalletLogLine: "" };
  }

  componentDidMount() {
    this.props.setInterval(() => {
      Promise
        .all([ getcdrLastLogLine(), getcdrwalletLastLogLine() ])
        .then(([ cdrLine, cdrwalletLine ]) => {
          const lastcdrLogLine = parseLogLine(cdrLine);
          const lastcdrwalletLogLine = parseLogLine(cdrwalletLine);
          if ( lastcdrLogLine !== this.state.lastcdrLogLine ||
              lastcdrwalletLogLine !== this.state.lastcdrwalletLogLine)
          {
            this.setState({ lastcdrLogLine, lastcdrwalletLogLine });
          }
        });
    }, 2000);
  }

  render () {
    const { startupError, getCurrentBlockCount } = this.props;

    return (
      <Aux>
        {!getCurrentBlockCount && <LastLogLinesFragment {...this.state} />}
        {startupError && <StartupErrorFragment {...this.props} />}
      </Aux>
    );
  }
}

export default ReactTimeout(StartRPCBody);
