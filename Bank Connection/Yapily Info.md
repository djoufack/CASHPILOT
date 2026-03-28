> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.yapily.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Yapily Data

> Access real-time financial data from banks using Yapily's Open Banking data API. Retrieve accounts, balances, transactions, and identity information with user consent.

---

## Introduction

Yapily Data enables you to access Account Information Services (AIS) for banks across the UK and Europe through a single API integration.

Understanding consents is key to accessing financial data. See [Understanding Consents](/concepts/consent-lifecycle).

AIS allows users to securely provide access to their financial information from multiple accounts to financial service providers in real-time.

Using Yapily's Data API you can access your customers' financial data including account balances, transaction history and account details to create personalised financial products and services. This includes if your customer has a consumer, business or corporate account.

Yapily's Data API normalises all financial data received from banks, returning standardised, consistent data back to you. This enables you to quickly and easily interpret and action the data.

<Note>
  You must be [registered](/getting-started/integration-setup/registration) as an Account Information Service Provider (AISP) to access AIS via Yapily Data API. If you aren't regulated by a central authority, you can use [Yapily Connect](/tools-and-services/yapily-connect/overview) to gain simple, easy and fast access without needing to obtain a Third-Party Provider licence.
</Note>

---

## Advantages

The 3 main benefits of AIS:

#### 1. Personalised solutions

Gain a complete, unified view across all of your customer's finances to enable you to offer personalised products and services.

#### 2. Proactive customer management

Get access to financial data to gain a deeper understanding of your customer to help anticipate change in consumer behaviour.

#### 3. Accurate data for inclusive decisions

Access financial data to improve risk profiling and affordability models for more informed, inclusive decision making.

---

## Applications

You can use Yapily's Data API to enhance your product offering in many ways.

**Personal finance management:**
Aggregate and link all accounts in one place to build a consolidated financial overview. Enable individuals and businesses to track and manage their spending, set budgets, and make financial plans.

**Account information:**
Securely access business, corporate and personal financial information.

**Financial profiling:**
Analyse and anticipate financial behaviour to make more informed decisions about your customers. Early detection of vulnerable customers and likelihood of missing payments.

**Reconciliation:**
Reconcile bank statements with real time transaction data directly from the bank.

**Credit risk & affordability:**
Make informed lending decisions by getting real-time visibility on an individual's transaction data to accurately assess creditworthiness and affordability. Analyse financial data that isn't typically considered such as rental payments and savings.

Don't see your use case? [Let us know](https://www.yapily.com/company/get-started) how you would like to use Yapily Data.

---

## End user journey

For the user, the journey consists of 3 steps:

1. The end user wants to share their financial data with you.
2. The user selects their bank and completes the data authorisation flow to give their permission for you to access their financial data.
3. The user is directed back to your application on completion.

The data experience can be embedded into any application. You build and self-host the user facing screens, giving you full ownership and control over the experience in your application, with the Yapily Data API powering the data connection behind the scenes.

<Note>
  We recommend you follow our [AIS UX guidelines](/tools-and-services/yapily-connect/yapilyconnect-ux-ais-guidelines) for examples of best practices when building the user facing screens.
</Note>

<Note>
  Banks use different methods to authenticate and collect consent from users. Yapily supports all [user authorisation flows](/open-banking-flow/user-authorisation/overview) and you may need to implement multiple user authorisation flows depending on which banks you want to integrate with.
</Note>

---

## Get started

See our [account and transaction data tutorial](/data/tutorial-account-and-trans-data) to explore a sample integration with Yapily Data.

Try our [demo app](https://demo.yapily.com/) to complete the Yapily Data flow for yourself with your real banking credentials.

<Info>
  Looking for further data enrichment? See our [Yapily Data Plus](/data/data-plus/overview) product, which offers advanced data sorting and analysis options. Yapily Data Plus can be easily added to Yapily Data to provide an enhanced view of your customers financial data.
</Info>

---

## Related resources

### Product Resources

- [Data Plus](/data/data-plus/overview) - Categorisation, balance prediction, and transaction analysis
- [Data Validate](/data/validate/overview) - Verify user identity and account ownership
- [Financial Data Resources](/data/financial-data-resources/financial-data-features) - Data features, consents, and restrictions

### Implementation Resources

For error handling, retry strategies, webhooks, testing, and support, see our [Developer Resources](/resources/overview) guide.

Built with [Mintlify](https://mintlify.com).
