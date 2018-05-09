import { FormattedMessage as T } from "react-intl";
import { StandalonePage, StandaloneHeader } from "layout";
import AccountRow from "./AccountRow";
import { commanderuLoading } from "indicators";
import { InfoDocModalButton, PassphraseModalButton } from "buttons";
import { AddAccountModal } from "modals";

const AccountsListHeader = ({ onGetNextAccountAttempt }) =>
  <StandaloneHeader
    title={<T id="accounts.title" m="Accounts" />}
    description={<T id="accounts.description" m={"Accounts allow you to keep separate records of your cdr funds.\nTransferring cdr across accounts will create a transaction on the blockchain."}/>}
    iconClassName="accounts"
    actionButton={
      <PassphraseModalButton
        modalTitle={<T id="accounts.newAccountConfirmations" m="Create new account" />}
        modalComponent={AddAccountModal}
        onSubmit={onGetNextAccountAttempt}
        buttonLabel={<T id="accounts.addNewButton" m="Add New" />}
      />}
  />;

const AccountsList = ({
  accounts,
  isLoading,
  onGetNextAccountAttempt,
  onShowAccount,
  onHideAccount,
  onRenameAccount,
  onShowAccountDetails,
  onHideAccountDetails,
  accountNumDetailsShown,
}) => (
  <StandalonePage header={<AccountsListHeader {...{ onGetNextAccountAttempt }} />}>
    { isLoading ? <commanderuLoading/> :
      <Aux>
        <div className="account-content-title-buttons-area">
          <InfoDocModalButton document="BalanceOverviewInfo" modalClassName="info-modal-fields" />
        </div>
        <div className="account-content-nest">
          {accounts.map(account => (
            <AccountRow
              key={account.accountName}
              account={account}
              accountNumDetailsShown={accountNumDetailsShown}
              renameAccount={onRenameAccount}
              hideAccount={onHideAccount}
              showAccount={onShowAccount}
              showAccountDetails={onShowAccountDetails}
              hideAccountDetails={onHideAccountDetails}
            />
          ))}
        </div>
      </Aux> }
  </StandalonePage>
);

AccountsList.propTypes = {
  accounts: PropTypes.array.isRequired,
  isLoading: PropTypes.bool.isRequired,
  onGetNextAccountAttempt: PropTypes.func.isRequired,
  onShowAccount: PropTypes.func.isRequired,
  onHideAccount: PropTypes.func.isRequired,
  onRenameAccount: PropTypes.func.isRequired,
  onShowAccountDetails: PropTypes.func.isRequired,
  onHideAccountDetails: PropTypes.func.isRequired,
  accountNumDetailsShown: PropTypes.number,
};

export default AccountsList;
