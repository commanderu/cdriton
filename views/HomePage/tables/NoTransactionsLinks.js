import { Link } from "react-router-dom";
import { FormattedMessage as T } from "react-intl";
import { ExternalLink } from "shared";

export default () => (
  <div className="overview-no-transactions">
    <Link to="/transactions/receive" className="receive">
      <T id="home.noTransactions.receiveLink" m="Generate a cdr Address for receiving funds" /> →
    </Link>
    <ExternalLink href="https://docs.commanderu.org/getting-started/obtaining-cdr/" className="buy">
      <T id="home.noTransactions.buyFromExchanges" m="Buy commanderu from Exchanges" /> →
    </ExternalLink>
  </div>
);
