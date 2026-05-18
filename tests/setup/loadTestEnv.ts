import { config as loadEnvironmentFile } from "dotenv";

loadEnvironmentFile({ path: ".env" });
loadEnvironmentFile();

process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID_INTL ??=
  "plan_test_intl_monthly";
process.env.RAZORPAY_PRO_YEARLY_PLAN_ID_INTL ??= "plan_test_intl_yearly";
