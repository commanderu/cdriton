import Logs from "./Page";
import { getcdrLogs, getcdrwalletLogs, getcommanderuitonLogs } from "wallet";
import { logging } from "connectors";
import { DescriptionHeader } from "layout";
import { FormattedMessage as T } from "react-intl";

export const LogsTabHeader = () =>
  <DescriptionHeader
    description={<T id="help.description.logs" m="Please find your current logs below to look for any issue or error you are having." />}
  />;
@autobind
class LogsTabBody extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.getInitialState();
  }

  getInitialState() {
    return {
      cdrLogs: null,
      cdrwalletLogs: null,
      commanderuitonLogs: null,
    };
  }

  render() {
    const { showcommanderuitonLogs, showcdrLogs, showcdrwalletLogs,
      hidecommanderuitonLogs, hidecdrLogs, hidecdrwalletLogs
    } = this;
    const { isDaemonRemote, isDaemonStarted } = this.props;
    const {
      cdrLogs, cdrwalletLogs, commanderuitonLogs
    } = this.state;
    return (
      <Logs
        {...{
          ...this.props, ...this.state }}
        {...{
          showcommanderuitonLogs,
          showcdrLogs,
          showcdrwalletLogs,
          hidecommanderuitonLogs,
          hidecdrLogs,
          hidecdrwalletLogs,
          cdrLogs,
          cdrwalletLogs,
          commanderuitonLogs,
          isDaemonRemote,
          isDaemonStarted
        }}
      />
    );
  }

  showcommanderuitonLogs() {
    getcommanderuitonLogs()
      .then(logs => {
        this.setState({ commanderuitonLogs: Buffer.from(logs).toString("utf8") });
      })
      .catch(err => console.error(err));
  }

  hidecommanderuitonLogs() {
    this.setState({ commanderuitonLogs: null });
  }

  showcdrLogs() {
    getcdrLogs()
      .then(logs => {
        this.setState({ cdrLogs: Buffer.from(logs).toString("utf8") });
      })
      .catch(err => console.error(err));
  }

  hidecdrLogs() {
    this.setState({ cdrLogs: null });
  }

  showcdrwalletLogs() {
    getcdrwalletLogs()
      .then(logs => {
        this.setState({ cdrwalletLogs: Buffer.from(logs).toString("utf8") });
      })
      .catch(err => console.error(err));
  }

  hidecdrwalletLogs() {
    this.setState({ cdrwalletLogs: null });
  }
}

export const LogsTab = logging(LogsTabBody);
