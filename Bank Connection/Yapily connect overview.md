> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.yapily.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Yapily Connect Overview

> Yapily Connect provides a ready-built, white-label open banking UI for AIS and PIS flows. Reduce development effort with pre-built institution selection and consent screens.

---

<Info>
  For an introduction to licensing options and how they fit into your integration, see [Licensing & Registration](/concepts/licensing-and-registration).
</Info>

## Introduction

Yapily Connect is Yapily's Financial Conduct Authority (FCA) registered entity. Yapily Connect grants you simple, easy and quick access to open banking data and payments without the need to obtain a Third-Party Provider (TPP) license.

As a TPP, Yapily Connect can provide Account Information Service Provider (AISP) and Payment Initiation Service Provider (PISP) licenses on your behalf to access the Open Banking network.

This removes the complexity and cost of acquiring the necessary license to access the open banking network if you are not currently registered.

---

## Integration differences

- Yapily handles [institution registration](/getting-started/integration-setup/registration#delegated-registration) for you
- You display **Yapily Connect** as the regulated entity that is requesting your customer's financial data or initiating a payment
- The user sees **Yapily Connect Ltd/UAB** instead of your company's name when they log in to their bank
- You use the [callback URL](/open-banking-flow/handling-redirects/callback-url) to specify the user journey. You must use Yapily's default [redirect URL](/open-banking-flow/handling-redirects/redirect-url)

---

## Yapily Guidelines for User Journey Compliance

These Guidelines for User Journey Compliance ("Guidelines") apply to the user journey
experienced by Payment Service Users ("PSUs") of Yapily Connect Ltd and Yapily Connect UAB (collectively, "Yapily Connect" or "we").

By "user journey", we refer to the process by which a PSU decides to use our open banking services (via our commercial customer) - i.e. the basis upon which they give Yapily Connect their consent to access their account information when we are providing Account Information Service ("AIS") or to initiate a payment when we are providing Payment Initiation Service ("PIS").

These Guidelines should be adhered to Yapily Connect customers. References to "you" and to Yapily Connect customers in these Guidelines are references to any Yapily Connect clients (and any Sub Clients) who incorporate aspects of Yapily Connect's regulated AIS/PIS services into their product propositions with PSUs.

These Guidelines have been prepared taking into account the regulatory requirements that apply in the UK and Lithuania as well as the Customer Experience Guidelines issued by the Open Banking Implementation Entity (OBIE) v 3.1.10. published on the 4th of April 2022 ("OBIE Guidelines") which form part of the Open Banking Standards in the UK.

These Guidelines apply to the design and development of Custom User Journeys. Custom User Journeys are "tailor-made" user flows designed and implemented by you (or Sub Clients) , under Yapily Connect's supervision and according to the requirements set out in these Guidelines.

It is essential that PSUs are clearly informed about the consent they are providing, the service they are receiving and from whom they are receiving regulated services.

Yapily Connect focuses on the specific "pieces" of the user journey in column 1 and 3 below, taking into account the roles of all participants from the perspective of the user journey being one overall experience.

<img src="https://mintcdn.com/yapily/DOGnmkCLngHjnTOu/images/knowledge/safeconnect/yapily-connect-user-journey-fixed.png?fit=max&auto=format&n=DOGnmkCLngHjnTOu&q=85&s=5ae5be31dd2c81c405bd81fb6b687770" alt="Yapily Connect customer journey" width="910" height="226" data-path="images/knowledge/safeconnect/yapily-connect-user-journey-fixed.png" />

#### Account information service

- [Yapily Connect AIS UX Guidelines](/tools-and-services/yapily-connect/yapilyconnect-ux-ais-guidelines)

#### Payment initiation service

- [Yapily Connect PIS UX Guidelines](/tools-and-services/yapily-connect/yapilyconnect-ux-pis-guidelines)

<Info>
  The guidance offered here does not constitute legal advice. While guidance has been created with regard to relevant regulatory provisions and best practice, they are not a complete list of the
  regulatory or legal obligations that apply to participants. Although intended to be consistent with regulations and laws in the event of any conflict with such regulations and laws, those regulations
  and laws will take priority. Participants are responsible for their own compliance with all regulations and laws that apply to them, including without limitation, PSD2, GDPR, consumer protection laws
  and anti-money laundering regulations.
</Info>

### Other resources

- <a href="https://eba.europa.eu/regulation-and-policy/payment-services-and-electronic-money/regulatory-technical-standards-on-strong-customer-authentication-and-secure-communication-under-psd2" target="_blank">EBA PSD2 Regulatory Technical Standards on SCA</a>
- <a href="https://standards.openbanking.org.uk/customer-experience-guidelines" target="_blank">Open Banking Customer Experience Standards</a>
- <a href="https://www.openbanking.org.uk/wp-content/uploads/Customer-Experience-Guidelines.pdf" target="_blank">OBIE Customer Experience Guidelines</a>

Built with [Mintlify](https://mintlify.com).
