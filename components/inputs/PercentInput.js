import NumericInput from "./NumericInput";
import balanceConnector from "connectors/balance";

// FeeInput is an input that restricts values to a fee (cdr/KB or similar)
const PercentInput = ({ ...props }) =>
  <NumericInput {...{ ...props, unit: "%" }} />;

export default balanceConnector(PercentInput);
