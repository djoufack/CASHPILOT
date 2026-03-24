Scrada API V1 (1.24)
E-mail: info@scrada.be
Introduction
This API document describes the Scrada API.

Changelog
1.24
Company invoice support payment method 10 Standing agreement.
Add invoice and Add sales invoice support UOM 500 Hectare.
Add invoice and Add sales invoice support for OIN number.
1.23
New Add UBL invoice endpoint added.
New Get sales invoice UBL document endpoint added.
New Get sales invoice send status endpoint added.
1.22
Add sales invoice extended with despatchDocumentReference and deliveryIdentifier.
Add sales invoice extended with lines standardItemIdentifier and purchaseOrderLineReference.
Send sales invoice and Send self-billing invoice extended with despatchDocumentReference and deliveryIdentifier.
Send sales invoice and Send self-billing invoice extended with lines standardItemIdentifier and purchaseOrderLineReference.
1.21
Add sales invoice extended with lines additionalProperties.
Add sales invoice extended with attachments externalReference.
Send sales invoice and Send self-billing invoice extended with lines additionalProperties.
Send sales invoice and Send self-billing invoice extended with attachments externalReference.
1.20
Peppol outbound Send self-billing invoice added.
1.19
Add sales invoice endpoint also supports amounts including VAT.
Peppol outbound Send sales invoice endpoint also supports amounts including VAT.
Peppol inbound Get PDF of inbound document added.
Rate limiting documentation added.
1.18
New Add sales invoice endpoint added.
Existing Add invoice endpoint marked as deprecated.
Peppol outbound Send sales invoice endpoint added.
1.17
Peppol functionality is added. Companies of type 'Peppol Only' can register customers on Peppol, receive inbound documents and put documents on Peppol.
1.16
Add invoice lines extended with ItemGroup.
1.15
Add lines to journal extended with CashBookTransactions.
1.14
Journal returns MinimumPossibleLineDate and MaximumPossibleLineDate.
Journal has a setting AllowMultipleEntries.
Cash book returns MinimumPossibleLineDate and MaximumPossibleLineDate.
1.13
Journal AddFiguresApi has a new option 5.
1.12
Company invoice extended with InvoiceSend, PartyLanguageCode, PartyTaxNumberType, PartyTaxNumber, and PartyGlnNumber.
Company invoice support payment method 1 Unknown, 9 Debit Card.
1.11
Add cash book lines extended with optional properties ExternalReference and ExternalData.
1.10
Add invoice lines extended with AccountingAnalytical1 till AccountingAnalytical5.
Add lines to the journal response extended with Message.
1.9
Company invoice PartyAccountingCode added.
Company invoice line AccountingGeneralLedger added.
1.8
Company invoice VAT types added.
1.7
Add AllowMultiple to Payment method.
1.6
Company invoices added.
Add lines to the journal extended with InvoiceID, InvoiceReference ExternalReference and ExternalData.
1.5
Cash book, Company, VAT period and Journal API's added.
1.4
Extended add lines to the cash book with additional (optional) fields.
1.3
Minor fixes.
1.2
Add lines to the cash book added.
Environments
Test environment:

URL API: https://apitest.scrada.be/v1/...
URL web client: https://mytest.scrada.be
If you want an account for the test environment, please send an email to info@scrada.be
In the test environment everything is working except the e-mail service. Because of that it is not possible to change you password, create new user accounts, ...
Production environment:

URL API: https://api.scrada.be/v1/...
URL web client: https://my.scrada.be
Postman collection: https://www.postman.com/scrada

Authentication
api_key
Authentication on the Scrada API is handled using API keys. The API Key and corresponding password are added to every request on the API using the following header keys:

X-API-KEY
X-PASSWORD
The API key and password are unique for each company in Scrada.

To obtain an API key go to the Scrada web client. In the menu go to 'Settings' > 'API Keys'.

API Keys

Here you can either create an API Key or see existing API keys of your company.

Data formats
The Scrada API expects data in the following way.

Data type Expected format Example
Number Use a . [dot] as decimal separator.
If not specified max. 2 numbers after the decimal separator. 3.55
Date yyyy-mm-dd 2022-12-31
Timestamp yyyy-MM-ddTHH:mm:ss.fffZ 2022-12-31T08:00:00.000Z
Localization
The API is, like the Scrada Mobile app and web client, multilingual. To change the response language you can set the header key Language, the following values can be used:

Value Language
EN English
NL Dutch
FR French
English will be used when no language key is provided.

Rate limiting
To ensure fair usage and maintain optimal performance, our API enforces rate limiting using a token bucket algorithm.

Maximum Requests per Minute: 60
Token Replenishment: Every 10 seconds, your bucket is refilled with 10 tokens
This allows for short bursts of activity while maintaining a steady request rate over time. If your token bucket is empty, additional requests will be rate-limited until new tokens are added. This configuration is subject to change. You should follow the information as provided in the http headers.

Each API response includes the following headers to help you monitor your usage:

Header Description
x-ratelimit-limit The maximum number of requests your bucket can hold or accumulate
x-ratelimit-remaining The number of requests remaining in the current window
x-ratelimit-reset A UNIX timestamp (in seconds) indicating the time when the next token replenishment will occur.
We recommend implementing logic in your client to respect these headers and avoid hitting the rate limit.

If you exceed the allowed request rate, the API will respond with:

HTTP Status Code: 429 Too Many Requests
When this occurs, you should wait until the x-ratelimit-reset time has passed before retrying your request.

Examples
Add daily receipt and invoice payment
This examples show how you can add a sales invoice in Scrada and add a payment to one invoice.

1. Add the invoice

Add a sales invoice in Scrada by using the Add sales invoice API.

https://api.scrada.be/v1/company/{companyID}/salesInvoice

Fore more information about this API call go to the Invoice > Add sales invoice section.

{
"bookYear": "2023",
"journal": "Store1",
"number": "123",
"creditInvoice": false,
"invoiceDate": "2023-01-01",
"invoiceExpiryDate": "2023-01-08",
"customer": {
"code" : "CUST01",
"name": "Customer 01",
"address": {
"street": "Customer street",
"streetNumber": "1",
"city": "Fropus",
"zipCode": "1000",
"countryCode": "BE"
},
"email": "info@scrada.be",
"vatNumber": "BE0793904121"
},
"totalInclVat": 200.00,
"totalVat": 34.71,
"totalExclVat": 165.29,
"payableRoundingAmount": 0,
"note": "",
"lines": [
{
"lineNumber": "1",
"itemName": "Demo item",
"quantity": 1,
"unitType": 1,
"itemExclVat": 165.29,
"vatType": 1,
"vatPercentage": 21,
"totalDiscountExclVat": 0,
"totalExclVat": 165.29
}
],
"vatTotals": [
{
"vatType": 1,
"vatPercentage": 21,
"totalExclVat": 165.29,
"totalVat": 34.71,
"totalInclVat": 200.00
}
 ],
"paymentMethods": [
{
"paymentType": 9,
"paymentReference": "+++022/0126/70950+++",
"name": "Bancontact",
"totalPaid": 0,
"totalToPay": 200
}
]
}
This will return a GUID, for example cac6315f-ef7a-4405-b1cf-1ccccc2cc007. We will use this GUID in the next step to add a payment to the sales invoice.

2. Add journal lines

Now we will add €500,00 of dailyreceipts to the journal, of which €400,00 was paid by Bancontact and €100,00 cash, and add a payment of €200,00 paid by Bancontact to the invoice we created in step 1. We add the lines using the Add lines to the journal API.

https://api.scrada.be/v1/company/{companyID}/journal/{journalID}/lines

{
"date": "2023-01-01",
"lastJournalLineID": "{lastJournalLineID}", // Optional GUID from your previous add journal lines call
"lines": [
{
"lineType": 1,
"vatTypeID": "8424d909-78b9-483c-9b1d-4584fb537846",
"vatPerc": 21,
"amount": 500,
"categoryID": "{categoryID}", // 21% VAT category
"externalReference": "", // Additional reference from your system
"externalData": "" // Additional information from your system like receipts numbers and their individual amounts
}
],
"paymentMethods": [
{
"paymentMethodID": "{paymentMethodID}", // Bancontact payment method ID
"amount": 600.00, // Total received 600.00 by Bancontact
"remark": "",
"externalReference": "", // Additional reference from your system
"externalData": "" // Additional information from your system like receipts numbers and their individual amounts
},
{
"paymentMethodID": "{paymentMethodID}", // Cash payment method ID
"amount": 100.00, // Received 100.00 cash
"remark": "",
"externalReference": "", // Additional reference from your system
"externalData": "" // Additional information from your system like receipts numbers and their individual amounts
},
{
"paymentMethodID": "{paymentMethodID}", // Invoice payed payment method ID
"amount": -200.00, // Deduct paid invoice amount
"remark": "string",
"invoiceID": "cac6315f-ef7a-4405-b1cf-1ccccc2cc007", // GUID of the invoice created in step 1
"invoiceReference": "+++022/0126/70950+++", // Optional invoice reference, when invoiceID is provided Scrada will add a payment reference if provided on the invoice
"externalReference": "", // Additional reference from your system
"externalData": "" // Additional information from your system like receipts number and its amount
}
]
}
This will return a GUID for the journalLInes, the last journalLines GUID can be used in your next add journal lines call lastJournalLineID.

Webhook topics
Webhooks are organized into topics. Your app subscribes to one or more topics to receive webhooks. Once configured, your app will receive webhooks each time that type of event is triggered for that company.

The webhook topic defines the kind of event messages that your app receives. For example, your app can subscribe to the journal/linesMissing topic to be notified when you are behind on journal entries. The topic name identifies the nature of the event that's occurred.

journal/linesMissing
The topic journal/linesMissing is triggered once a day if a journal has missing lines. This is triggered at the same time that Scrada also send emails if journal lines are missing. Normally this is around 12:30. A formatted payload of this topic looks like:

{
"companyID":"da31b6ec-ba3e-448c-b808-f3a7f8a53859",
"companyCode":"",
"companyName":"Example company",
"journalID":"48dbd6cf-42a7-4565-be6b-f41544a56b28",
"journalCode":"003",
"journalName":"jounal4",
"journalDateOfLastEntry":"2021-01-10"
}
peppolOutboundDocument/statusUpdate
The topic peppolOutboundDocument/statusUpdate is triggered when the status of an outbound Peppol document is changed. More information about the properties of the webhook can can be found in the section Peppol Outbound > Get outbound document status. The API call and the webhook return the same information.

A formatted payload of a status Created:

{
"id": "21a076e5-ee44-47a4-a21b-a7b45682d54f",
"createdOn": "2024-12-24T12:00:06.187Z",
"externalReference": "test-invoice-scrada-1",
"status": "Created",
"attempt": 0,
"errorMessage": "",
"peppolSenderID": "9915:test-sender",
"peppolReceiverID": "0208:0793904121",
"peppolC1CountryCode": "BE",
"peppolC2Timestamp": null,
"peppolC2SeatID": "PBE000659",
"peppolC2MessageID": null,
"peppolC3Timestamp": null,
"peppolC3SeatID": null,
"peppolC3MessageID": null,
"peppolConversationID": null,
"peppolSbdhInstanceID": null,
"peppolDocumentTypeScheme": "busdox-docid-qns",
"peppolDocumentTypeValue": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
"peppolProcessScheme": "cenbii-procid-ubl",
"peppolProcessValue": "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
"salesInvoiceID": "21a076e5-ee44-47a4-a21b-a7b45682d54g"
}
A formatted payload of a status Processed:

{
"id": "21a076e5-ee44-47a4-a21b-a7b45682d54f",
"createdOn": "2024-12-24T12:00:06.187Z",
"externalReference": "test-invoice-scrada-1",
"status": "Processed",
"attempt": 1,
"errorMessage": "",
"peppolSenderID": "9915:test-sender",
"peppolReceiverID": "0208:0793904121",
"peppolC1CountryCode": "BE",
"peppolC2Timestamp": "2024-12-24T12:00:23.039Z",
"peppolC2SeatID": "PBE000659",
"peppolC2MessageID": "21a076e5-ee44-47a4-a21b-a7b45682d54f@scrada",
"peppolC3Timestamp": "2024-12-24T12:00:23.743Z",
"peppolC3SeatID": "PBE000659",
"peppolC3MessageID": "3f34cb91-afc6-4a0f-8b13-90ff6c99e28a@phase4",
"peppolConversationID": "conv-21a076e5-ee44-47a4-a21b-a7b45682d54f@scrada",
"peppolSbdhInstanceID": "21a076e5-ee44-47a4-a21b-a7b45682d54f",
"peppolDocumentTypeScheme": "busdox-docid-qns",
"peppolDocumentTypeValue": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
"peppolProcessScheme": "cenbii-procid-ubl",
"peppolProcessValue": "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
"salesInvoiceID": "21a076e5-ee44-47a4-a21b-a7b45682d54g"
}
A formatted payload of a status error:

{
"id": "b91a383b-0c96-467a-b791-ffe971b6c52d",
"createdOn": "2024-12-24T12:16:18.958Z",
"externalReference": "test-invoice-scrada-2",
"status": "Error",
"attempt": 1,
"errorMessage": "[error] [SAX] cvc-complex-type.2.4.a: Invalid content was found starting with element '{\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\":DueDatee}'. ...",
"peppolSenderID": "9915:test-sender",
"peppolReceiverID": "0208:0793904121",
"peppolC1CountryCode": "BE",
"peppolC2Timestamp": null,
"peppolC2SeatID": "PBE000659",
"peppolC2MessageID": "b91a383b-0c96-467a-b791-ffe971b6c52d@scrada",
"peppolC3Timestamp": null,
"peppolC3SeatID": null,
"peppolC3MessageID": null,
"peppolConversationID": "conv-b91a383b-0c96-467a-b791-ffe971b6c52d@scrada",
"peppolSbdhInstanceID": "b91a383b-0c96-467a-b791-ffe971b6c52d",
"peppolDocumentTypeScheme": "busdox-docid-qns",
"peppolDocumentTypeValue": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
"peppolProcessScheme": "cenbii-procid-ubl",
"peppolProcessValue": "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
"salesInvoiceID": "21a076e5-ee44-47a4-a21b-a7b45682d54g"
}
salesInvoice/sendStatusUpdate
The topic salesInvoice/sendStatusUpdate is triggered when the send status to customer of a sales invoice is changed. This is only triggered if a full subscription of Scrada is active. It is not trigged when you have a Peppol Only subscription. In case of Peppol Only subscription you have to use the topic peppolOutboundDocument/statusUpdate.

More information about the properties of the webhook can be found in the section Invoice > Get sales invoice send status. The API call and the webhook return the same information.

A formatted payload of a status Created:

{
"id": "916ae8fa-2531-4cad-9c64-6218187f1db4",
"createdOn": "2025-02-20T17:14:58.755Z",
"externalReference": "DB_1|46a5e373-4337-4d68-92be-30ec6d2c7d90",
"peppolSenderID": null,
"peppolReceiverID": null,
"peppolC1CountryCode": null,
"peppolC2Timestamp": null,
"peppolC2SeatID": null,
"peppolC2MessageID": null,
"peppolC3MessageID": null,
"peppolC3Timestamp": null,
"peppolC3SeatID": null,
"peppolConversationID": null,
"peppolSbdhInstanceID": null,
"peppolDocumentTypeScheme": null,
"peppolDocumentTypeValue": null,
"peppolProcessScheme": null,
"peppolProcessValue": null,
"status": "Created",
"attempt": 0,
"errorMessage": "",
"peppolOutboundDocumentID": "851afd33-ad37-4538-9456-4297f133e724",
"sendMethod": "Peppol",
"receiverEmailAddress": null,
"receiverEmailTime": null,
"receiverEmailStatus": "Not sent"
}
A formatted payload of a status Processed and sent by Peppol:

{
"id": "916ae8fa-2531-4cad-9c64-6218187f1db4",
"createdOn": "2025-02-20T17:14:58.755Z",
"externalReference": "DB_1|46a5e373-4337-4d68-92be-30ec6d2c7d90",
"peppolSenderID": "0208:0793904121",
"peppolReceiverID": "0208:0793904121",
"peppolC1CountryCode": "BE",
"peppolC2Timestamp": "2025-02-20T17:15:24.119Z",
"peppolC2SeatID": "PBE000659",
"peppolC2MessageID": "916ae8fa-2531-4cad-9c64-6218187f1db4@scrada",
"peppolC3MessageID": "aa3e293c-70a5-491a-a317-8e884bd6a628@phase4",
"peppolC3Timestamp": "2025-02-20T17:15:24.430Z",
"peppolC3SeatID": "PBE000659",
"peppolConversationID": "conv-916ae8fa-2531-4cad-9c64-6218187f1db4@scrada",
"peppolSbdhInstanceID": "916ae8fa-2531-4cad-9c64-6218187f1db4",
"peppolDocumentTypeScheme": "busdox-docid-qns",
"peppolDocumentTypeValue": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1",
"peppolProcessScheme": "cenbii-procid-ubl",
"peppolProcessValue": "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
"status": "Processed",
"attempt": 1,
"errorMessage": "",
"peppolOutboundDocumentID": "851afd33-ad37-4538-9456-4297f133e724",
"sendMethod": "Peppol",
"receiverEmailAddress": null,
"receiverEmailTime": null,
"receiverEmailStatus": "Not sent"
}
A formatted payload of a status Processed and sent by email:

{
"id": "916ae8fa-2531-4cad-9c64-6218187f1db4",
"createdOn": "2025-02-20T17:09:25.509Z",
"externalReference": "DB_1|46a5e373-4337-4d68-92be-30ec6d2c7d90",
"peppolSenderID": "0208:0793904121",
"peppolReceiverID": "0208:0793904121",
"peppolC1CountryCode": "BE",
"peppolC2Timestamp": null,
"peppolC2SeatID": null,
"peppolC2MessageID": "916ae8fa-2531-4cad-9c64-6218187f1db4@scrada",
"peppolC3MessageID": null,
"peppolC3Timestamp": null,
"peppolC3SeatID": null,
"peppolConversationID": "conv-916ae8fa-2531-4cad-9c64-6218187f1db4@scrada",
"peppolSbdhInstanceID": "916ae8fa-2531-4cad-9c64-6218187f1db4",
"peppolDocumentTypeScheme": null,
"peppolDocumentTypeValue": null,
"peppolProcessScheme": null,
"peppolProcessValue": null,
"status": "Processed",
"attempt": 1,
"errorMessage": "",
"peppolOutboundDocumentID": null,
"sendMethod": "Email",
"receiverEmailAddress": "info@scrada.be",
"receiverEmailTime": "2025-02-20T17:09:30.509Z",
"receiverEmailStatus": "Successfully sent"
}
peppolInboundDocument/new
The topic peppolInboundDocument/new is triggered when a new document arrives by Peppol in Scrada and you have a Peppol Only Subscription. In case of a full subscription you have to use the topic purchaseInvoice/new.

This webhook has some extra headers:

Header Description
x-scrada-peppol-process-scheme Document Process Scheme. Sample: cenbii-procid-ubl
x-scrada-peppol-process-value Document Process Value. Sample: urn:fdc:peppol.eu:2017:poacc:billing:01:1.0
x-scrada-peppol-document-type-scheme Document Type Scheme. Sample: busdox-docid-qns
x-scrada-peppol-document-type-value Document Type Value. Sample: urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1
x-scrada-peppol-sbdh-instance-identifier SBDH Instance ID. Is only needed if sending invoice responses. Sample: bc2c2348-b932-430c-ab29-4139c08f7a20
x-scrada-peppol-conversation-id Conversation ID. Sample: conv-bc2c2348-b932-430c-ab29-4139c08f7a20@scrada
x-scrada-peppol-c3-timestamp The time the message arrived at Scrada. Sample: 2024-12-23T16:56:31.290Z
x-scrada-peppol-c3-message-id The ID assigned to the received message by Scrada and sent back to the other access point. Sample: 2879a6d1-c1cf-48e2-9cbb-890acdeb83c2@otherAccessPoint
x-scrada-peppol-c3-incoming-unique-id The internal ID assigned to the message by Scrada. Sample: f6732cec-c25a-4c3f-ad3f-2c7694b41123
x-scrada-peppol-c2-message-id The ID assigned by the other access point to the message sent to Scrada. Sample: bc2c2348-b932-430c-ab29-4139c08f7a20@scrada
x-scrada-peppol-c2-seat-id The seat ID of the other access point. Every access point has an unique seat ID. Sample: PBE000659
x-scrada-peppol-c2-timestamp The time the message was sent by the other access point to Scrada. Sample: 2024-12-23T16:56:31.112Z
x-scrada-peppol-c1-country-code The country code of the sender. Sample: BE
x-scrada-peppol-receiver-scheme The scheme of the receiving Peppol ID used. This is always: iso6523-actorid-upis
x-scrada-peppol-receiver-id The Peppol ID of the receiving party. Sample: 0208:0793904121
x-scrada-peppol-sender-scheme The scheme of the sender Peppol ID used. This is always: iso6523-actorid-upis
x-scrada-peppol-sender-id The Peppol ID of the sending party. Sample: 9915:test-sender
x-scrada-document-internal-number The internal number assigned to this document. The first document arrived is 1, ...
x-scrada-document-id The ID assigned to the document in the Scrada system. This ID is needed later if you want to get the document again. Sample: ea951819-f902-4504-8791-af2c1fe46ef3
content-type The content type of the payload in the body. Sample: application/xml; charset=utf-8
The content of the payload is the received document from Peppol. This depends of the document type. If registered on certain document type then these document types can be received.

purchaseInvoice/new
The topic purchaseInvoice/new is triggered when a new purchase invoice arrives in Scrada. This is only triggered if a full subscription of Scrada is active. It is not trigged when you have a Peppol Only subscription. In case of Peppol Only subscription you have to use the topic peppolInboundDocument/new. This can also be triggered if a new purchase invoice arrives in Scrada from another channel than Peppol.

This webhook has some extra headers:

Header Description
x-scrada-invoice-id The purchase invoice ID in Scrada. Sample: b9cdf00b-49a1-45b7-9336-6a28c3101e78
x-scrada-invoice-number The purchase invoice number assigned by the supplier. Sample: 24A1554
x-scrada-invoice-internal-number The internal number assigned to this purchase invoice. The first document arrived is 1, ...
x-scrada-invoice-date The date of the purchase invoice in the format YYYY-MM-DD. Sample: 2024-12-20
x-scrada-invoice-expiry-date The expiry date of the purchase invoice. If the purchase invoice has no expiry date then this header is missing. Sample: 2024-12-20
x-scrada-supplier-party-name The name of the supplier. Sample: Scrada BV
x-scrada-customer-party-name The name of the customer. Sample: Scrada BV
x-scrada-total-incl-vat Total value of the purchase invoice inclusive VAT. Decimal separator is a dot. Sample 121.01
x-scrada-total-excl-vat Total value of the purcahse invoice exclusive VAT. Decimal separator is a dot. Sample 100.01
x-scrada-total-vat Total VAT of the purcahse invoice. Decimal separator is a dot. Sample 21.00
x-scrada-credit-invoice Indication if the purchase invoice is an invoice or a creditnote. If creditnote then the value is 'true' else the value is 'false'
content-type The content type of the payload in the body. Usually it is XML but it can also be PDF. Sample: application/xml; charset=utf-8
If the purchase invoice arrived by Peppol then also the headers of peppolInboundDocument/new are available in this topic.

The content of the payload depends from the channel that was used to deliver the purchase invoice to Scrada. If it is Peppol then most of the times this is an XML document. But it can also be a PDF if a PDF was uploaded manually by the user.

journal/newInvoiceUbl
The topic journal/newInvoiceUbl is triggered whenever a daily receipts invoice is created.

Payload: The invoice UBL data (XML).

cashBook/newStatementCoda
The topic cashBook/newStatementCoda is triggered when a cash book statement is created.

Payload: The statement in CODA format.

cashBook/newStatementMt940
The topic cashBook/newStatementMt940 is triggered when a cash book statement is created.

Payload: The statement in MT940 format.

Webhooks
Add webhooks
A webhook subscription declares the app’s intention to receive webhooks for a topic. A subscription is defined by:

The topic name
The subscription endpoint: The endpoint is the destination that Scrada sends the webhooks to. This can be either HTTP or HTTPS.
A webhook can be configured on company or on partner company level using the Scrada web client. In the menu go to 'Settings' > 'Integrations', click on the 'Activate'/'Edit' button in the 'Webhook' tile. If configured on partner company then this subscription will be active for all companies linked to this partner company.

Headers
Each webhook is made up of headers and a payload. Headers contain metadata about the webhook.

Header Description
x-scrada-topic The name of the topic. (Example: journal/linesMissing)
x-scrada-hmac-sha256 HMAC SHA256 verification hash of the payload.
x-scrada-api-version The version of the Scrada API.
x-scrada-company-id ID of the company where the webhook is configured on (can be company ID of the partner company or company ID itself)
x-scrada-event-id Unique ID of the webhook event.
x-scrada-triggered-at Identifying the date and time when Scrada triggered the webhook. This is in UTC time.
x-scrada-attempt Attempt number of calling this webhook by Scrada. The first call is 1.
Verification
HMAC stands for Hash-based Message Authentication Code (HMAC) that can be used to determine whether a message sent over an insecure channel has been tampered with, provided that the sender and receiver share a secret key. The sender computes the hash value for the original data and sends both the original data and the HMAC as a single message. The receiver recomputes the hash value on the received message and checks that the computed hash value matches the transmitted hash value.

The secret key used to calculate the HMAC can be found in Scrada using the Scrada web client. In the menu go to 'Settings' > 'Company' and click on the eye icon next to 'Secret key'. If you ever need to generate a new secret key this can be done by clicking on the generate icon next to the eye icon.

If no secret key is present on the company the x-scrada-hmac-sha256 will be empty. Generate a new secret as described above.

Scrada uses the algorithm SHA-256.

Here are a few links to popular languages with HMAC capabilities:

NodeJS
Python
PHP
.NET C#
Sample calculation HMAC by Scrada:

Input:
Payload:
{"companyID":"da31b6ec-ba3e-448c-b808-f3a7f8a53859","companyCode":"","companyName":"Example company","journalID":"48dbd6cf-42a7-4565-be6b-f41544a56b28","journalCode":"003","journalName":"jounal4","journalDateOfLastEntry":"2021-01-10"}
Secret key: s4%^>>s8Ov$fB+szc3H&(\_N@NVmOiy6&
Algorithm: SHA-256
Output: 8e60bd58050f2b7846f6b9df1a3ee523b88dfb7805ef6d30f5a8162a9132c66d
Online tool to calculate a HMAC is https://www.freeformatter.com/hmac-generator.html.
Ordering event data
As with other webhook systems, Scrada doesn't guarantee ordering within a topic, or across different topics for the same resource. For example, it's possible that a salesinvoice/update webhook might be delivered before a salesinvoice/create webhook. Scrada recommends using timestamps provided in the header x-scrada-triggered-at to organize webhooks.

Responses and retries
A http status success response 200 till 299 is considered successful. If your webhook didn't respond with a 200 till 299 http status code, then the delivery failed. If the delivery fails, then it's retried up to 10 times.

Logging
All webhooks executed with their status can be found in the Scrada web client. In the menu go to 'Settings' > 'Integrations', click on the 'History' button in the 'Webhook' tile. A webhook that is retrying can be cancelled using the Scrada web client.

Handling duplicate webhooks
In rare instances, your app may receive the same webhook event more than once. Scrada recommends detecting duplicate webhook events by comparing the x-scrada-event-id header to previous events x-scrada-event-id header.

x-scrada-topic: journal/linesMissing
x-scrada-hmac-sha256: 9c57b3a7e877c7d0f1116c6c4a399354a380b9a461ff1a8c07c9855464757b04
x-scrada-api-version: 1.0
x-scrada-company-id: da31b6ec-ba3e-448c-b808-f3a7f8a53859
x-scrada-event-id: 116445c1-f6f7-4fa1-809b-c69d91724713
x-scrada-triggered-at: 2024-10-10T19:10:35.815Z
x-scrada-attempt: 1
Testing webhooks
The website https://webhook.site/ can be used to see the headers and body of a webhook that is called by Scrada. Add the unique URL that is generated by https://webhook.site/ to the webhooks configuration in Scrada and see the webhooks called by Scrada.

Add line
Add lines to the cash book
Add new transaction lines to a cash book.
To obtain the current (/start) balance get the current cash book object (Get cash book function) and use the 'currentBalance' field.

path Parameters
companyID
required
string <uuid>
cashBookID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
date
required
string <date>
The transaction date.

startBalance
required
number <double>
The current cash book balance. Max precision is 2.

lines
required
Array of objects (v1.CashBookAddLineModel)
The transaction lines to add in the cash book.

endBalance
required
number <double>
The cash book balance after the provided line transactions. Max precision is 2.

Responses
200 Added line GUID ID's.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/cashBook/{cashBookID}/lines

Request samples
Payload
Content type

application/json
application/json

Copy
Expand allCollapse all
{
"date": "2019-08-24",
"startBalance": 0,
"lines": [
{}
],
"endBalance": 0
}
Response samples
200500
Content type
application/json

Copy
[
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
]
Add lines to the journal
Add new transaction lines to a daily receipts book.
To obtain the last journal line ID get the current journal object (Get journal function) and use the 'lastLineID' field.
The rules that are defined on VAT category or Payment method are also applied when using the API. This means that if configured that a payment method/VAT category must be positive that also the values in the API must be positive. If configured that it must be positive but the value is negative then there will be an error.
It is not always required to have payment methods. More information can be found on the 'PaymentMethods' property.

Remark: In case of a correction all lines must be of type Correction and also the remark of all lines must be the same.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
date
required
string <date>
The transaction date.

lastJournalLineID
string or null <uuid>
Optional the GUID ID of the last entered line. When provided a check will be performed to verify that this was indeed the last created line ID.

lines
required
Array of objects (v1.AddJournalLineModel)
The lines to add in the journal.

paymentMethods
Array of objects or null (v1.AddJournalPaymentMethodModel)
How the daily receipts are paid.
The sum of the amounts of the payment methods must be the same as the sum of the amounts of the lines.

If the journal is not linked to a cash book then the payment methods must be blanc.
If a journal is linked to a cash book but the journal is configured that payment methods are booked as proposal then it is not required to fill in the payment methods. In all other cases the payments must be set.

A certain payment method can only be used multiple times in this list if configured on the payment method that this is allowed!

On payment method several requirements can be active like remark required or not, amount can be positive, ... This can be configured on the payment method itself. It is checked both when entering manual data or when using the API.

cashBookTransactions
Array of objects or null (v1.CashBookAddLineModel)
Additional cash book transactions.

If the journal is not linked to a cash book then the cash book transactions must be blanc.

Responses
200 Added line information.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/journal/{journalID}/lines

Request samples
Payload
Content type

application/json
application/json

Copy
Expand allCollapse all
{
"date": "2019-08-24",
"lastJournalLineID": "3c22b09b-1d1a-4ef4-9f78-9d83f56e0b7a",
"lines": [
{}
],
"paymentMethods": [
{}
],
"cashBookTransactions": [
{}
]
}
Response samples
200500
Content type
application/json

Copy
Expand allCollapse all
{
"journalLines": [
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
],
"cashBookLines": [
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
],
"message": {
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": []
}
}
Cash book
Get all cash books
Get all cash books belonging to this company.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Cash books.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/cashBook

Response samples
200500
Content type
application/json

Copy
Expand allCollapse all
[
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"active": true,
"name": "string",
"startDate": "2019-08-24T14:15:22Z",
"endDate": "2019-08-24T14:15:22Z",
"iban": "string",
"startBalance": 0,
"currentBalance": 0,
"lastLineDate": "2019-08-24T14:15:22Z",
"warnBalanceTooHigh": 0,
"codaFileType": 1,
"codaGenerationPeriodType": 1,
"codaGenerationStartWeekDay": 0,
"allowEntryAfterCoda": true,
"addPaymentReference": true,
"invoicedTill": "2019-08-24T14:15:22Z",
"paidTill": "2019-08-24T14:15:22Z",
"minimumPossibleLineDate": "2019-08-24T14:15:22Z",
"maximumPossibleLineDate": "2019-08-24T14:15:22Z"
}
]
Create cash book
Add a new cash book.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
active
boolean or null
Show the cash book in the dashboard.

name
required
string
The cash book name.

startDate
required
string or null <date-time>
The start date.

endDate
string or null <date-time>
The closing date.

startBalance
number or null <double>
The start balance.

warnBalanceTooHigh
number or null <double>
Optional warning level for high balance.

codaFileType
integer <int32> (v1.CashBookFormatType)
Enum: 1 2
The CODA format.

1: Only lines
2: Lines and payment methods
codaGenerationPeriodType
integer <int32> (v1.CashBookCodaGenerationPeriodType)
Enum: 1 2 3
The CODA generation period.

1: Every day
2: Every week
3: Every month
codaGenerationStartWeekDay
integer <int32> (v1.CashBookCodaGenerationDayOfWeek)
Enum: 0 1 2 3 4 5 6
Day of the week to generate CODA file.

0: Sunday
1: Monday
2: Tuesday
3: Wednesday
4: Thursday
5: Friday
6: Saturday
allowEntryAfterCoda
boolean or null
Allow entries in the cash book after a CODA file has been generated. Only applicable when the cash book is linked to a journal.

addPaymentReference
boolean or null
Add journal payment reference to CODA files.

Responses
200 Added cash book ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/cashBook

Request samples
Payload
Content type

application/json
application/json

Copy
{
"active": true,
"name": "string",
"startDate": "2019-08-24T14:15:22Z",
"endDate": "2019-08-24T14:15:22Z",
"startBalance": 0,
"warnBalanceTooHigh": 0,
"codaFileType": 1,
"codaGenerationPeriodType": 1,
"codaGenerationStartWeekDay": 0,
"allowEntryAfterCoda": true,
"addPaymentReference": true
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Get cash book
Get the specified cash book.

path Parameters
companyID
required
string <uuid>
cashBookID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Cash book.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/cashBook/{cashBookID}

Response samples
200500
Content type
application/json

Copy
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"active": true,
"name": "string",
"startDate": "2019-08-24T14:15:22Z",
"endDate": "2019-08-24T14:15:22Z",
"iban": "string",
"startBalance": 0,
"currentBalance": 0,
"lastLineDate": "2019-08-24T14:15:22Z",
"warnBalanceTooHigh": 0,
"codaFileType": 1,
"codaGenerationPeriodType": 1,
"codaGenerationStartWeekDay": 0,
"allowEntryAfterCoda": true,
"addPaymentReference": true,
"invoicedTill": "2019-08-24T14:15:22Z",
"paidTill": "2019-08-24T14:15:22Z",
"minimumPossibleLineDate": "2019-08-24T14:15:22Z",
"maximumPossibleLineDate": "2019-08-24T14:15:22Z"
}
Update cash book
Update an existing cash book.
If a property of the cash book is set null or a property is missing then the system assumes that this property must keep its original value. Only in case of property endDate, if this property is missing or has value null, the system assumes that it has value null.

path Parameters
companyID
required
string <uuid>
cashBookID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
active
boolean or null
Show the cash book in the dashboard.

name
required
string
The cash book name.

startDate
required
string or null <date-time>
The start date.

endDate
string or null <date-time>
The closing date.

startBalance
number or null <double>
The start balance.

warnBalanceTooHigh
number or null <double>
Optional warning level for high balance.

codaFileType
integer <int32> (v1.CashBookFormatType)
Enum: 1 2
The CODA format.

1: Only lines
2: Lines and payment methods
codaGenerationPeriodType
integer <int32> (v1.CashBookCodaGenerationPeriodType)
Enum: 1 2 3
The CODA generation period.

1: Every day
2: Every week
3: Every month
codaGenerationStartWeekDay
integer <int32> (v1.CashBookCodaGenerationDayOfWeek)
Enum: 0 1 2 3 4 5 6
Day of the week to generate CODA file.

0: Sunday
1: Monday
2: Tuesday
3: Wednesday
4: Thursday
5: Friday
6: Saturday
allowEntryAfterCoda
boolean or null
Allow entries in the cash book after a CODA file has been generated. Only applicable when the cash book is linked to a journal.

addPaymentReference
boolean or null
Add journal payment reference to CODA files.

Responses
200 Cash book successfully updated.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/cashBook/{cashBookID}

Request samples
Payload
Content type

application/json
application/json

Copy
{
"active": true,
"name": "string",
"startDate": "2019-08-24T14:15:22Z",
"endDate": "2019-08-24T14:15:22Z",
"startBalance": 0,
"warnBalanceTooHigh": 0,
"codaFileType": 1,
"codaGenerationPeriodType": 1,
"codaGenerationStartWeekDay": 0,
"allowEntryAfterCoda": true,
"addPaymentReference": true
}
Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Link journal to cash book
Link an existing journal to an existing cash book. To remove an existing link between a journal and cashbook set the cash book ID to NULL.
When experiencing unsupported media type errors with the cash book ID (body) NULL add a 'Content-Type' header with value application/json.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
The cash book ID or NULL to remove the link.

string <uuid>
Responses
200 Journal successfully linked to cash book.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/journal/{journalID}/link

Request samples
Payload
Content type

application/json
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Transaction type
Get all transaction types
Get all transaction types belonging to this cash book.

path Parameters
companyID
required
string <uuid>
cashBookID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Transaction types.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/cashBook/{cashBookID}/transactionType

Response samples
200500
Content type
application/json

Copy
Expand allCollapse all
[
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"position": 0,
"inputType": 1,
"lineType": 1,
"commentType": 2
}
]
Create transaction type
Add a new cash book transaction type. New transaction types must have line type 14 (Own / custom).

path Parameters
companyID
required
string <uuid>
cashBookID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
nameNL
required
string or null <= 200 characters
The Dutch Transaction Type name.

nameEN
required
string or null <= 200 characters
The English Transaction Type name.

nameFR
required
string or null <= 200 characters
The French Transaction Type name.

nameDE
required
string or null <= 200 characters
The German Transaction Type name.

position
integer or null <int32>
The sorting position. Lowest is shown first.

inputType
integer <int32> (v1.CashBookTransactionTypeInputType)
Enum: 1 2 3 4
The input visibility.

1: Not visible
2: Only receive
3: Only expense
4: Receive or expense
lineType
integer or null <int32> (v1.CashBookTransactionTypeLineType)
Enum: 1 2 3 4 5 6 7 8 9 10 11 12 13 14
Transaction type of this line. Use either this line type or use the TransactionTypeID, not supported for custom transaction types.

1: Private take
2: Private deposit
3: Customer
4: Supplier
5: Transfer bank to cash
6: Transfer cash to bank
7: Cost
8: Cash difference
9: Daily receipts cash (Only allowed when no journal is linked)
12: Transfer cash to cash in
13: Transfer cash to cash out
14: Own/ custom type (Requires TransactionTypeID)
commentType
integer <int32> (v1.CashBookTransactionTypeCommentType)
Enum: 2 3
The comment visibility.

2: Optional
3: Required
Responses
200 Added transaction type ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/cashBook/{cashBookID}/transactionType

Request samples
Payload
Content type

application/json
application/json

Copy
{
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"position": 0,
"inputType": 1,
"lineType": 1,
"commentType": 2
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Get transaction type
Get the specified cash book transaction type.

path Parameters
companyID
required
string <uuid>
cashBookID
required
string <uuid>
transactionTypeID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Transaction type.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/cashBook/{cashBookID}/transactionType/{transactionTypeID}

Response samples
200500
Content type
application/json

Copy
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"position": 0,
"inputType": 1,
"lineType": 1,
"commentType": 2
}
Update transaction type
Update an existing cash book transaction type.
If a property of the transaction type is set null or a property is missing then the system assumes that this property must keep its original value.

path Parameters
companyID
required
string <uuid>
cashBookID
required
string <uuid>
transactionTypeID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
nameNL
required
string or null <= 200 characters
The Dutch Transaction Type name.

nameEN
required
string or null <= 200 characters
The English Transaction Type name.

nameFR
required
string or null <= 200 characters
The French Transaction Type name.

nameDE
required
string or null <= 200 characters
The German Transaction Type name.

position
integer or null <int32>
The sorting position. Lowest is shown first.

inputType
integer <int32> (v1.CashBookTransactionTypeInputType)
Enum: 1 2 3 4
The input visibility.

1: Not visible
2: Only receive
3: Only expense
4: Receive or expense
lineType
integer or null <int32> (v1.CashBookTransactionTypeLineType)
Enum: 1 2 3 4 5 6 7 8 9 10 11 12 13 14
Transaction type of this line. Use either this line type or use the TransactionTypeID, not supported for custom transaction types.

1: Private take
2: Private deposit
3: Customer
4: Supplier
5: Transfer bank to cash
6: Transfer cash to bank
7: Cost
8: Cash difference
9: Daily receipts cash (Only allowed when no journal is linked)
12: Transfer cash to cash in
13: Transfer cash to cash out
14: Own/ custom type (Requires TransactionTypeID)
commentType
integer <int32> (v1.CashBookTransactionTypeCommentType)
Enum: 2 3
The comment visibility.

2: Optional
3: Required
Responses
200 Transaction type successfully updated.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/cashBook/{cashBookID}/transactionType/{transactionTypeID}

Request samples
Payload
Content type

application/json
application/json

Copy
{
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"position": 0,
"inputType": 1,
"lineType": 1,
"commentType": 2
}
Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Company
Get company
Get the specified company.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Company.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}

Response samples
200500
Content type
application/json

Copy
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"active": true,
"code": "string",
"name": "string",
"email": "string",
"street": "string",
"zipCode": "string",
"city": "string",
"countryID": "bd19ff8d-7ba1-4038-b160-c71803bc9bc0",
"taxNumber": "string",
"vatNumber": "string",
"phone": "string",
"reportLanguageID": "f0f88c39-5cb3-4c3b-8d00-177eb738f7cf",
"invoiceInfo": 1,
"invoiceEmail": "string",
"invoiceStreet": "string",
"invoiceZipCode": "string",
"invoiceCity": "string",
"invoiceCountryID": "df13d8e7-0987-43f4-9448-3817f1e4d0d2",
"invoiceCompanyID": "27187182-1800-43a1-b0c3-e0debbc31c79"
}
Update company
Update an existing company.
If a property of the company is set null or a property is missing then the system assumes that this property must keep its original value.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
active
boolean or null
Show the company in the company overview screen.

code
string or null <= 200 characters
The company code. Is used by Scrada as parameter in emails or integrations

name
required
string or null <= 200 characters
The company name.

email
required
string or null <= 250 characters
The company email.

street
required
string or null <= 1000 characters
The company street.

zipCode
required
string or null <= 50 characters
The company ZIP code.

city
required
string or null <= 250 characters
The company city.

countryID
required
string or null <uuid>
The company country ID.

12b741b9-c0ad-42b5-8471-e720763f3227: België/Belgique
97e88925-b346-4b76-b671-ef1cf7d68733: Nederland
74a68d03-8c08-4074-a41e-59d830024344: France
597fde4e-a4db-42ac-99e1-af3962bbffa4: Deutschland
taxNumber
string or null <= 30 characters
The company tax number.

België/Belgique: ondernemingsnummer/numéro d’Entreprise
Nederland: KvK nummer
France: SIRENE
Deutschland: Handelsregisternummer
vatNumber
string or null <= 30 characters
The company VAT number.

phone
required
string or null <= 50 characters
The company phone number.

reportLanguageID
required
string or null <uuid>
The language ID in which language the company reports (like daily receipt invoice) need to be generated in.

e1e8395c-35b3-4282-89db-3feeaacc23bd: Nederlands (nl-BE)
5300381e-f434-4e01-a1f8-53e7676d4cac: Français (fr-BE)
68f89f67-b153-43e6-b9a6-f8d73b56a67a: English (en-US)
invoiceInfo
required
integer <int32> (v1.CompanyInvoiceInfo)
Enum: 1 2 3
The invoice information to use.

1: Company address
2: Invoice address
3: Other company information
invoiceEmail
string or null <= 250 characters
The email address to receive the invoices on. If not provided the invoice will be sent to the company email. Not applicable when 'invoiceInfo' is set to 3.

invoiceStreet
string or null <= 1000 characters
The invoice street. Only applicable when 'invoiceInfo' is set to 2.

invoiceZipCode
string or null <= 50 characters
The invoice ZIP code. Only applicable when 'invoiceInfo' is set to 2.

invoiceCity
string or null <= 250 characters
The invoice city. Only applicable when 'invoiceInfo' is set to 2.

invoiceCountryID
string or null <uuid>
The invoice country ID. Only applicable when 'invoiceInfo' is set to 2.

12b741b9-c0ad-42b5-8471-e720763f3227: België/Belgique
97e88925-b346-4b76-b671-ef1cf7d68733: Nederland
74a68d03-8c08-4074-a41e-59d830024344: France
597fde4e-a4db-42ac-99e1-af3962bbffa4: Deutschland
invoiceCompanyID
string or null <uuid>
The company ID to which the invoice needs to be sent. Only applicable when 'invoiceInfo' is set to 3.
Remark: To set a different invoice company the user needs to have access rights to both companies. The API credentials only provide access to a single company, it is therefore not possible to change this setting using the external API.

Responses
200 Company successfully updated.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}

Request samples
Payload
Content type

application/json
application/json

Copy
{
"active": true,
"code": "string",
"name": "string",
"email": "string",
"street": "string",
"zipCode": "string",
"city": "string",
"countryID": "bd19ff8d-7ba1-4038-b160-c71803bc9bc0",
"taxNumber": "string",
"vatNumber": "string",
"phone": "string",
"reportLanguageID": "f0f88c39-5cb3-4c3b-8d00-177eb738f7cf",
"invoiceInfo": 1,
"invoiceEmail": "string",
"invoiceStreet": "string",
"invoiceZipCode": "string",
"invoiceCity": "string",
"invoiceCountryID": "df13d8e7-0987-43f4-9448-3817f1e4d0d2",
"invoiceCompanyID": "27187182-1800-43a1-b0c3-e0debbc31c79"
}
Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Invoice
Add sales invoice
Add a new sales invoice. The combination bookYear, journal and number must be unique. This cannot be used if you have a Peppol Only subscription. You have to use Peppol outbound>Send sales invoice instead.
If a property is set null or a property is missing then we assume that this property must keep its original value.
The sum of lines.totalExclVat must be the same as the sum vatTotals.totalExclVat and must be the same as totalExclVat on header.
The VAT is calculated by Scrada by doing a sum of all the lines.totalExclVat by VAT percentage and calculating the VAT on it. This may have a max of 2% difference with the VAT set in vatTotals.totalVat.",

Peppol / UBL: There are different codes used to identify a company in the UBL or on the Peppol network. Scrada will determine the company identifier in following order. The first identifier that is set is used.

`customer`.`peppolID`
`customer`.`glnNumber`
`customer`.`taxNumber`
`customer`.`vatNumber`
`customer`.`accountingCode` (If this is the identifier then this invoice cannot be sent over Peppol)
`customer`.`email` (If this is the identifier then this invoice cannot be sent over Peppol)
path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
bookYear
required
string <= 200 characters
The book year in which the invoice is created. This is required but can be an empty string.

journal
required
string <= 200 characters
The journal name or code. This is required but can be an empty string.

number
required
string [ 1 .. 250 ] characters
The invoice number. Can contain alphanumeric characters.

externalReference
string or null
The reference you give to the invoice. This is not required. This is not used for Peppol but is used in the portal of Scrada and in the webhooks.

creditInvoice
boolean or null
The invoice is a credit invoice. Default value is false.

isInclVat
boolean or null
The invoice pricing is including VAT. Default value is false. When set to true the including VAT pricing on line level are required and excluding VAT pricing must remain 'null', vise versa when set to false.

invoiceReference
string or null <= 250 characters
The invoice or credit note to which this document refers. This is not required. For example, in the case of a credit note, this is the invoice number credited by the credit note.

invoiceDate
required
string <date>
The invoice date.

invoiceExpiryDate
string or null <date>
The invoice expiry date.

alreadySendToCustomer
boolean or null
Indicator if the invoice is already sent to the customer. If not (by default) Scrada can send the invoice based on settings in the company.

accountingCost
string or null
The buyer accounting reference.

buyerReference
string or null
The buyer's reference.

purchaseOrderReference
string or null
The purchase order reference.

salesOrderReference
string or null
The sales order reference.

despatchDocumentReference
string or null
The despatch document reference.

projectReference
string or null
The project reference, this is only allowed for an invoice.

customer
required
object (Sales invoice customer)
delivery
object (Sales invoice delivery)
totalExclVat
required
number <double>
The total invoice amount excluding VAT. Default value is 0. Max precision is 2.

totalInclVat
required
number <double>
The total invoice amount including VAT. Default value is 0. Max precision is 2.

totalVat
required
number <double>
The total invoice VAT amount. Default value is 0. Max precision is 2.

currency
string or null <= 3 characters
The currency of the invoice according to ISO 4217. Default value is EUR.

payableRoundingAmount
number or null <double>
The payable rounding amount. The amount to be added to the invoice total to round the amount to be paid. Max precision is 2.

note
string or null
The invoice comment.

lines
required
Array of objects (Sales invoice line)
The invoice lines.

vatTotals
required
Array of objects (Sales invoice VAT total)
The VAT totals.

paymentTerms
string or null
The payment terms for the invoice. Example: Net within 30 days.

paymentMethods
Array of objects (Invoice payment method)
The payment methods.

attachments
Array of objects or null (Invoice attachment)
The attachments related to the invoice.

Responses
200 Added invoice ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/salesInvoice

Request samples
Payload
Content type

application/json
application/json

Copy
Expand allCollapse all
{
"bookYear": "string",
"journal": "string",
"number": "string",
"externalReference": "string",
"creditInvoice": true,
"isInclVat": true,
"invoiceReference": "string",
"invoiceDate": "2019-08-24",
"invoiceExpiryDate": "2019-08-24",
"alreadySendToCustomer": true,
"accountingCost": "string",
"buyerReference": "string",
"purchaseOrderReference": "string",
"salesOrderReference": "string",
"despatchDocumentReference": "string",
"projectReference": "string",
"customer": {
"peppolID": "string",
"code": "string",
"accountingCode": "string",
"languageCode": "st",
"name": "string",
"address": {},
"phone": "string",
"email": "string",
"invoiceEmail": "string",
"contact": "string",
"taxNumberType": 1,
"taxNumber": "string",
"vatNumber": "string",
"glnNumber": "string",
"extraIdentifiers": []
},
"delivery": {
"deliveryDate": "2019-08-24",
"address": {},
"identifierType": 1,
"identifier": "string"
},
"totalExclVat": 0,
"totalInclVat": 0,
"totalVat": 0,
"currency": "str",
"payableRoundingAmount": 0,
"note": "string",
"lines": [
{}
],
"vatTotals": [
{}
],
"paymentTerms": "string",
"paymentMethods": [
{}
],
"attachments": [
{}
]
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Add UBL invoice
Add a new sales invoice or self-billing outbound invoice. The combination bookYear, journal and number must be unique. This cannot be used if you have a Peppol Only subscription. You have to use Peppol outbound>Send document instead.
Document must be a valid UBL.BE or BIS3 invoice or credit note. Send the document with content type application/xml or text/xml. Default charset that is used is utf-8.
The system will automatically detect if the document is a sales invoice or a self-billing invoice based on the UBL content.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

x-scrada-peppol-document-type-scheme
required
string
The document type scheme used. Example: busdox-docid-qns

x-scrada-peppol-document-type-value
required
string
The document type used. Example: urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1

x-scrada-peppol-process-scheme
required
string
The process scheme used. Example: cenbii-procid-ubl

x-scrada-peppol-process-value
required
string
The process used. Example: urn:fdc:peppol.eu:2017:poacc:billing:01:1.0

x-scrada-book-year
required
string
The book year in which the invoice is created. This is required but can be an empty string.

x-scrada-journal-code
required
string
The journal name or code. This is required but can be an empty string.

x-scrada-external-reference
string
The reference you give to the document. This header is not required. This is not used for Peppol but is used in the portal of Scrada and in the webhooks. Example: V1/202400512

Responses
200 Added invoice ID.
401 Unauthorized. The API Key and/or Password is wrong.
415 Unsupported media type. The content (or content-type header) is not of the type XML.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/salesInvoice/document

Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Get invoice UBL document
Gets the UBL document of a specific sales invoice or self-billing invoice.

path Parameters
companyID
required
string <uuid>
salesInvoiceID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 The UBL document of the invoice
401 Unauthorized. The API Key and/or Password is wrong.
404 Invoice not found or no UBL available.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/salesInvoice/{salesInvoiceID}/ubl

Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Get invoice send status
Gets the send status of a specific sales invoice (to customer) or self-billing invoice (to supplier).

path Parameters
companyID
required
string <uuid>
salesInvoiceID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 The send status of the requested invoice
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/salesInvoice/{salesInvoiceID}/sendStatus

Response samples
200500
Content type
application/json

Copy
{
"id": "string",
"createdOn": "string",
"externalReference": "string",
"peppolSenderID": "string",
"peppolReceiverID": "string",
"peppolC1CountryCode": "string",
"peppolC2Timestamp": "string",
"peppolC2SeatID": "string",
"peppolC2MessageID": "string",
"peppolC3MessageID": "string",
"peppolC3Timestamp": "string",
"peppolC3SeatID": "string",
"peppolConversationID": "string",
"peppolSbdhInstanceID": "string",
"peppolDocumentTypeScheme": "string",
"peppolDocumentTypeValue": "string",
"peppolProcessScheme": "string",
"peppolProcessValue": "string",
"status": "string",
"attempt": 0,
"errorMessage": "string",
"peppolOutboundDocumentID": "string",
"sendMethod": "string",
"receiverEmailAddress": "string",
"receiverEmailTime": "string",
"receiverEmailStatus": "string"
}
Add self-billing invoice
Add a new selfbilling invoice or credit note. The combination bookYear, journal and number must be unique. This cannot be used if you have a Peppol Only subscription. You have to use Peppol outbound>Send self-billing invoice instead.
The sum of lines.totalExclVat must be the same as the sum vatTotals.totalExclVat and must be the same as totalExclVat on the invoice header.
The VAT is calculated by Scrada by doing a sum of all the lines.totalExclVat by VAT percentage and calculating the VAT on it. This may have a max of 2% difference with the VAT set in vatTotals.totalVat.

Peppol / UBL: There are different codes used to identify a company (supplier) in the UBL or on the Peppol network. Scrada will determine the company identifier in following order. The first identifier that is set is used.

`supplier`.`peppolID`
`supplier`.`glnNumber`
`supplier`.`taxNumber`
`supplier`.`vatNumber`
`supplier`.`accountingCode` (If this is the identifier then this invoice cannot be sent over Peppol)
`supplier`.`email` (If this is the identifier then this invoice cannot be sent over Peppol)
path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
bookYear
required
string <= 200 characters
The book year in which the invoice is created. This is required but can be an empty string.

journal
required
string <= 200 characters
The journal name or code. This is required but can be an empty string.

number
required
string [ 1 .. 250 ] characters
The invoice number. Can contain alphanumeric characters.

externalReference
string or null
The reference you give to the invoice. This is not required. This is not used for Peppol but is used in the portal of Scrada and in the webhooks.

creditInvoice
boolean or null
The invoice is a credit invoice. Default value is false.

isInclVat
boolean or null
The invoice pricing is including VAT. Default value is false. When set to true the including VAT pricing on line level are required and excluding VAT pricing must remain 'null', vise versa when set to false.

invoiceReference
string or null <= 250 characters
The invoice or credit note to which this document refers. This is not required. For example, in the case of a credit note, this is the invoice number credited by the credit note.

invoiceDate
required
string <date>
The invoice date.

invoiceExpiryDate
string or null <date>
The invoice expiry date.

alreadySentToSupplier
boolean or null
Indicator if the invoice is already sent to the supplier.

accountingCost
string or null
The buyer accounting reference.

buyerReference
string or null
The buyer's reference.

purchaseOrderReference
string or null
The purchase order reference.

salesOrderReference
string or null
The sales order reference.

despatchDocumentReference
string or null
The despatch document reference.

projectReference
string or null
The project reference, this is only allowed for an invoice.

supplier
required
object (Sales invoice supplier)
delivery
object (Sales invoice delivery)
totalExclVat
required
number <double>
The total invoice amount excluding VAT. Default value is 0. Max precision is 2.

totalInclVat
required
number <double>
The total invoice amount including VAT. Default value is 0. Max precision is 2.

totalVat
required
number <double>
The total invoice VAT amount. Default value is 0. Max precision is 2.

currency
string or null <= 3 characters
The currency of the invoice according to ISO 4217. Default value is EUR.

payableRoundingAmount
number or null <double>
The payable rounding amount. The amount to be added to the invoice total to round the amount to be paid. Max precision is 2.

note
string or null
The invoice comment.

lines
required
Array of objects (Sales invoice line)
The invoice lines.

vatTotals
required
Array of objects (Sales invoice VAT total)
The VAT totals.

paymentTerms
string or null
The payment terms for the invoice. Example: Net within 30 days.

paymentMethods
Array of objects (Invoice payment method)
The payment methods.

attachments
Array of objects or null (Invoice attachment)
The attachments related to the invoice.

Responses
200 Added invoice ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/selfBillingInvoice

Request samples
Payload
Content type

application/json
application/json

Copy
Expand allCollapse all
{
"bookYear": "string",
"journal": "string",
"number": "string",
"externalReference": "string",
"creditInvoice": true,
"isInclVat": true,
"invoiceReference": "string",
"invoiceDate": "2019-08-24",
"invoiceExpiryDate": "2019-08-24",
"alreadySentToSupplier": true,
"accountingCost": "string",
"buyerReference": "string",
"purchaseOrderReference": "string",
"salesOrderReference": "string",
"despatchDocumentReference": "string",
"projectReference": "string",
"supplier": {
"peppolID": "string",
"code": "string",
"accountingCode": "string",
"languageCode": "st",
"name": "string",
"address": {},
"phone": "string",
"email": "string",
"invoiceEmail": "string",
"contact": "string",
"taxNumberType": 1,
"taxNumber": "string",
"vatNumber": "string",
"glnNumber": "string",
"extraIdentifiers": []
},
"delivery": {
"deliveryDate": "2019-08-24",
"address": {},
"identifierType": 1,
"identifier": "string"
},
"totalExclVat": 0,
"totalInclVat": 0,
"totalVat": 0,
"currency": "str",
"payableRoundingAmount": 0,
"note": "string",
"lines": [
{}
],
"vatTotals": [
{}
],
"paymentTerms": "string",
"paymentMethods": [
{}
],
"attachments": [
{}
]
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Add invoice Deprecated
This method is obsolete. Please use the Add sales invoice endpoint.
Add a new sales/purchase invoice.
For a sales invoice the party references to the customer.
For a purchase invoice the party references the supplier.

Peppol / UBL: There are different codes used to identify a company in the UBL or on the Peppol network. Scrada will use the following information as company identifier.

`PartyTaxNumber` (Can be used to send invoice over the Peppol network)
`PartyVatNumber` (Can be used to send invoice over the Peppol network)
`PartyGlnNumber` (Can be used to send invoice over the Peppol network)
`partyAccountingCode`
`partyEmail`
path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
bookYear
required
string <= 200 characters
The book year in which the invoice is created. Scrada will check that the following combination is unique: BookYear, Journal, Number and Type. This field cannot be 'NULL'.

journal
required
string <= 200 characters
The journal name or code. This field cannot be 'NULL'.

number
required
string [ 1 .. 250 ] characters
The invoice number.

type
integer <int32> (v1.CompanyInvoiceType)
Value: 1
The invoice type.

1: Sales invoice
creditInvoice
boolean or null
The invoice is a credit invoice. Default value is false

invoiceDate
required
string <date>
The invoice date.

invoiceExpiryDate
required
string <date>
The invoice expiry date.

alreadySendToCustomer
boolean or null
Indicator if the invoice is already sent to the customer. If not (by default) Scrada can send the invoice.

accountingCost
string or null
The buyer accounting reference.

buyerReference
string or null
The buyer's reference.

purchaseOrderReference
string or null
The purchase order reference.

salesOrderReference
string or null
The sales order reference.

despatchDocumentReference
string or null
The despatch document reference.

projectReference
string or null
The project reference, this is only allowed for an invoice.

partyCode
string or null
The party identification code.

partyAccountingCode
string or null
The party identification code in the accounting system. This code is used as reference key to this party.

partyLanguageCode
string or null <= 2 characters
The party language code according to ISO 639-1.

partyName
required
string non-empty
The party name.

partyStreet
string or null
The party street.

partyStreetNumber
string or null
The party street number.

partyStreetBox
string or null
The party street postbox.

partyCity
string or null
The party city.

partyZipCode
string or null
The party ZIP code.

partyCountryCode
string or null <= 2 characters
The party country code according to ISO 3166-1 alpha 2.

deliveryDate
string or null <date>
The delivery date.

deliveryStreet
string or null
The delivery street.

deliveryStreetNumber
string or null
The delivery street number.

deliveryStreetBox
string or null
The delivery street postbox.

deliveryCity
string or null
The delivery city.

deliveryZipCode
string or null
The delivery ZIP code.

deliveryCountryCode
string or null <= 2 characters
The delivery country code according to ISO 3166-1 alpha 2. Required when any delivery property is provided.

deliveryIdentifierType
integer <int32> (v1.ItemIdentificationType)
Enum: 1 2 3 5 20 21 22
Specifies the type of identification number used to uniquely identify a company, organization, or item.

1: Numero d'entreprise / ondernemingsnummer / Unternehmensnummer / Enterprise number (Belgium)
2: Kamer van koophandel nummer (the Netherlands)
3: SIRENE (France)
5: Organisatie-Identificatienummer [OIN] (the Netherlands, must be 20 digits)
20: Global Location Number [GLN] (must be 13 digits)
21: Global Trade Item Number [GTIN] (must be 8, 12, 13, or 14 digits)
22: GS1 identification key (must be between 8 and 20 digits)
deliveryIdentifier
string or null
The delivery identifier. Required when deliveryIdentifierType is provided.

partyPhone
string or null <= 50 characters
The party phone number.

partyEmail
string or null <= 250 characters
The party email address.

partyInvoiceEmail
string or null <= 250 characters
The party invoice email address.

partyContact
string or null
The party contact name.

partyTaxNumberType
integer <int32> (v1.CompanyInvoiceTaxNumberType)
Enum: 1 2 3 5
The tax number typed used to identify the party.

1: Numero d'entreprise / ondernemingsnummer / Unternehmensnummer / Enterprise number (Belgium)
2: Kamer van koophandel nummer (the Netherlands)
3: SIRENE (France)
5: Organisatie-Identificatienummer [OIN] (the Netherlands, must be 20 digits)
partyTaxNumber
string or null
The party tax number according to the type PartyTaxNumberType.

partyVatNumber
string or null
The party VAT number. This must be a valid VAT number!

partyGlnNumber
string or null
The party GLN number. This must be a valid GLN number!

totalInclVat
number or null <double>
The total invoice amount including VAT. Default value is 0. Max precision is 2.

totalVat
number or null <double>
The total invoice VAT amount. Default value is 0. Max precision is 2.

totalExclVat
number or null <double>
The total invoice amount excluding VAT. Default value is 0. Max precision is 2.

payableRoundingAmount
number or null <double>
The payable rounding amount. The amount to be added to the invoice total to round the amount to be paid. Max precision is 2.

comment
string or null
The invoice comment.

lines
Array of objects or null (Invoice line)
paymentMethods
Array of objects or null (Invoice payment method)
filename
string or null
The invoice document file name including file extension.

mimeType
string or null
The invoice document mime type. The following mime types are supported:

text/csv
application/pdf
image/png
image/jpeg
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
application/vnd.oasis.opendocument.spreadsheet
base64Data
string or null
The invoice document with Base64 encoding.

Responses
200 Added invoice ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/invoice

Request samples
Payload
Content type

application/json
application/json

Copy
Expand allCollapse all
{
"bookYear": "string",
"journal": "string",
"number": "string",
"type": 1,
"creditInvoice": true,
"invoiceDate": "2019-08-24",
"invoiceExpiryDate": "2019-08-24",
"alreadySendToCustomer": true,
"accountingCost": "string",
"buyerReference": "string",
"purchaseOrderReference": "string",
"salesOrderReference": "string",
"despatchDocumentReference": "string",
"projectReference": "string",
"partyCode": "string",
"partyAccountingCode": "string",
"partyLanguageCode": "st",
"partyName": "string",
"partyStreet": "string",
"partyStreetNumber": "string",
"partyStreetBox": "string",
"partyCity": "string",
"partyZipCode": "string",
"partyCountryCode": "st",
"deliveryDate": "2019-08-24",
"deliveryStreet": "string",
"deliveryStreetNumber": "string",
"deliveryStreetBox": "string",
"deliveryCity": "string",
"deliveryZipCode": "string",
"deliveryCountryCode": "st",
"deliveryIdentifierType": 1,
"deliveryIdentifier": "string",
"partyPhone": "string",
"partyEmail": "string",
"partyInvoiceEmail": "string",
"partyContact": "string",
"partyTaxNumberType": 1,
"partyTaxNumber": "string",
"partyVatNumber": "string",
"partyGlnNumber": "string",
"totalInclVat": 0,
"totalVat": 0,
"totalExclVat": 0,
"payableRoundingAmount": 0,
"comment": "string",
"lines": [
{}
],
"paymentMethods": [
{}
],
"filename": "string",
"mimeType": "string",
"base64Data": "string"
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Update invoice Deprecated
Update an existing invoice.
If a property of the invoice is set null or a property is missing then the system assumes that this property must keep its original value.
If sending also a document of the invoice then this must always be sent for every update. If document is not send then it is removed from the invoice.

path Parameters
companyID
required
string <uuid>
invoiceID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
bookYear
required
string <= 200 characters
The book year in which the invoice is created. Scrada will check that the following combination is unique: BookYear, Journal, Number and Type. This field cannot be 'NULL'.

journal
required
string <= 200 characters
The journal name or code. This field cannot be 'NULL'.

number
required
string [ 1 .. 250 ] characters
The invoice number.

type
integer <int32> (v1.CompanyInvoiceType)
Value: 1
The invoice type.

1: Sales invoice
creditInvoice
boolean or null
The invoice is a credit invoice. Default value is false

invoiceDate
required
string <date>
The invoice date.

invoiceExpiryDate
required
string <date>
The invoice expiry date.

alreadySendToCustomer
boolean or null
Indicator if the invoice is already sent to the customer. If not (by default) Scrada can send the invoice.

accountingCost
string or null
The buyer accounting reference.

buyerReference
string or null
The buyer's reference.

purchaseOrderReference
string or null
The purchase order reference.

salesOrderReference
string or null
The sales order reference.

despatchDocumentReference
string or null
The despatch document reference.

projectReference
string or null
The project reference, this is only allowed for an invoice.

partyCode
string or null
The party identification code.

partyAccountingCode
string or null
The party identification code in the accounting system. This code is used as reference key to this party.

partyLanguageCode
string or null <= 2 characters
The party language code according to ISO 639-1.

partyName
required
string non-empty
The party name.

partyStreet
string or null
The party street.

partyStreetNumber
string or null
The party street number.

partyStreetBox
string or null
The party street postbox.

partyCity
string or null
The party city.

partyZipCode
string or null
The party ZIP code.

partyCountryCode
string or null <= 2 characters
The party country code according to ISO 3166-1 alpha 2.

deliveryDate
string or null <date>
The delivery date.

deliveryStreet
string or null
The delivery street.

deliveryStreetNumber
string or null
The delivery street number.

deliveryStreetBox
string or null
The delivery street postbox.

deliveryCity
string or null
The delivery city.

deliveryZipCode
string or null
The delivery ZIP code.

deliveryCountryCode
string or null <= 2 characters
The delivery country code according to ISO 3166-1 alpha 2. Required when any delivery property is provided.

deliveryIdentifierType
integer <int32> (v1.ItemIdentificationType)
Enum: 1 2 3 5 20 21 22
Specifies the type of identification number used to uniquely identify a company, organization, or item.

1: Numero d'entreprise / ondernemingsnummer / Unternehmensnummer / Enterprise number (Belgium)
2: Kamer van koophandel nummer (the Netherlands)
3: SIRENE (France)
5: Organisatie-Identificatienummer [OIN] (the Netherlands, must be 20 digits)
20: Global Location Number [GLN] (must be 13 digits)
21: Global Trade Item Number [GTIN] (must be 8, 12, 13, or 14 digits)
22: GS1 identification key (must be between 8 and 20 digits)
deliveryIdentifier
string or null
The delivery identifier. Required when deliveryIdentifierType is provided.

partyPhone
string or null <= 50 characters
The party phone number.

partyEmail
string or null <= 250 characters
The party email address.

partyInvoiceEmail
string or null <= 250 characters
The party invoice email address.

partyContact
string or null
The party contact name.

partyTaxNumberType
integer <int32> (v1.CompanyInvoiceTaxNumberType)
Enum: 1 2 3 5
The tax number typed used to identify the party.

1: Numero d'entreprise / ondernemingsnummer / Unternehmensnummer / Enterprise number (Belgium)
2: Kamer van koophandel nummer (the Netherlands)
3: SIRENE (France)
5: Organisatie-Identificatienummer [OIN] (the Netherlands, must be 20 digits)
partyTaxNumber
string or null
The party tax number according to the type PartyTaxNumberType.

partyVatNumber
string or null
The party VAT number. This must be a valid VAT number!

partyGlnNumber
string or null
The party GLN number. This must be a valid GLN number!

totalInclVat
number or null <double>
The total invoice amount including VAT. Default value is 0. Max precision is 2.

totalVat
number or null <double>
The total invoice VAT amount. Default value is 0. Max precision is 2.

totalExclVat
number or null <double>
The total invoice amount excluding VAT. Default value is 0. Max precision is 2.

payableRoundingAmount
number or null <double>
The payable rounding amount. The amount to be added to the invoice total to round the amount to be paid. Max precision is 2.

comment
string or null
The invoice comment.

lines
Array of objects or null (Invoice line)
paymentMethods
Array of objects or null (Invoice payment method)
filename
string or null
The invoice document file name including file extension.

mimeType
string or null
The invoice document mime type. The following mime types are supported:

text/csv
application/pdf
image/png
image/jpeg
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
application/vnd.oasis.opendocument.spreadsheet
base64Data
string or null
The invoice document with Base64 encoding.

Responses
200 Invoice successfully updated.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/invoice/{invoiceID}

Request samples
Payload
Content type

application/json
application/json

Copy
Expand allCollapse all
{
"bookYear": "string",
"journal": "string",
"number": "string",
"type": 1,
"creditInvoice": true,
"invoiceDate": "2019-08-24",
"invoiceExpiryDate": "2019-08-24",
"alreadySendToCustomer": true,
"accountingCost": "string",
"buyerReference": "string",
"purchaseOrderReference": "string",
"salesOrderReference": "string",
"despatchDocumentReference": "string",
"projectReference": "string",
"partyCode": "string",
"partyAccountingCode": "string",
"partyLanguageCode": "st",
"partyName": "string",
"partyStreet": "string",
"partyStreetNumber": "string",
"partyStreetBox": "string",
"partyCity": "string",
"partyZipCode": "string",
"partyCountryCode": "st",
"deliveryDate": "2019-08-24",
"deliveryStreet": "string",
"deliveryStreetNumber": "string",
"deliveryStreetBox": "string",
"deliveryCity": "string",
"deliveryZipCode": "string",
"deliveryCountryCode": "st",
"deliveryIdentifierType": 1,
"deliveryIdentifier": "string",
"partyPhone": "string",
"partyEmail": "string",
"partyInvoiceEmail": "string",
"partyContact": "string",
"partyTaxNumberType": 1,
"partyTaxNumber": "string",
"partyVatNumber": "string",
"partyGlnNumber": "string",
"totalInclVat": 0,
"totalVat": 0,
"totalExclVat": 0,
"payableRoundingAmount": 0,
"comment": "string",
"lines": [
{}
],
"paymentMethods": [
{}
],
"filename": "string",
"mimeType": "string",
"base64Data": "string"
}
Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
VAT period
Get all VAT periods
Get all VAT periods belonging to this company.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 VAT Periods.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/vatPeriod

Response samples
200500
Content type
application/json

Copy
Expand allCollapse all
[
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"fromDate": "2019-08-24T14:15:22Z",
"tillDate": "2019-08-24T14:15:22Z",
"vatPeriodType": 0
}
]
Create VAT period
Add a new journal VAT period.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
fromDate
string or null <date-time>
The starting date of the VAT period.

vatPeriodType
required
integer <int32> (v1.CompanyVatPeriodType)
Enum: 0 1 3 12
The VAT type.

0: No VAT obligation
1: Monty
3: Quarterly
12: Yearly
Responses
200 Added VAT period ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/vatPeriod

Request samples
Payload
Content type

application/json
application/json

Copy
{
"fromDate": "2019-08-24T14:15:22Z",
"vatPeriodType": 0
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Get VAT period
Get the specified company VAT period.

path Parameters
companyID
required
string <uuid>
vatPeriodID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 VAT period.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/vatPeriod/{vatPeriodID}

Response samples
200500
Content type
application/json

Copy
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"fromDate": "2019-08-24T14:15:22Z",
"tillDate": "2019-08-24T14:15:22Z",
"vatPeriodType": 0
}
Update VAT period
Update an existing company VAT period.

path Parameters
companyID
required
string <uuid>
vatPeriodID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
integer <int32> (v1.CompanyVatPeriodType)
Enum: 0 1 3 12
The VAT type.

0: No VAT obligation
1: Monty
3: Quarterly
12: Yearly
Responses
200 Vat period successfully updated.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/vatPeriod/{vatPeriodID}

Request samples
Payload
Content type

application/json
application/json

Copy
0
0
Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Journal
Get all journals
Get all journals belonging to this company.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Journals.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/journal

Response samples
200500
Content type
application/json

Copy
Expand allCollapse all
[
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"active": true,
"name": "string",
"startDate": "2019-08-24T14:15:22Z",
"endDate": "2019-08-24T14:15:22Z",
"lastLineDate": "2019-08-24T14:15:22Z",
"lastLineID": "16c2f113-478e-4b3a-8e6e-b0c5a0627baa",
"invoiceGenerationPeriodType": 1,
"invoiceGenerationStartWeekDay": 0,
"customerName": "string",
"customerReference": "string",
"invoiceNumberExternalFormat": "string",
"invoiceNumberExternalReset": "string",
"openOnMonday": true,
"openOnTuesday": true,
"openOnWednesday": true,
"openOnThursday": true,
"openOnFriday": true,
"openOnSaturday": true,
"openOnSunday": true,
"cashbookID": "da76995c-8bdc-4961-ae83-c79ba4470dba",
"emailNoLinesDays": 1,
"allowMultipleEntries": true,
"autoLoadPaymentProvider": true,
"addFiguresUser": 1,
"addFiguresApi": 1,
"invoicedTill": "2019-08-24T14:15:22Z",
"paidTill": "2019-08-24T14:15:22Z",
"minimumPossibleLineDate": "2019-08-24T14:15:22Z",
"maximumPossibleLineDate": "2019-08-24T14:15:22Z"
}
]
Create journal
Add a new journal.
The new journal will get a default VAT category after creation. This VAT category can be changed, as long as it remains unused, with the 'Update VAT category' API.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
active
boolean or null
Show the journal in the dashboard.

name
required
string or null
The journal name.

startDate
string or null <date-time>
The start date. If new book and not specified then today is used as start date.

endDate
string or null <date-time>
The closing date.

invoiceGenerationPeriodType
integer <int32> (v1.JournalInvoicePeriodType)
Enum: 1 2 3
The invoice generation period.

1: Every day
2: Every week
3: Every month
invoiceGenerationStartWeekDay
integer <int32> (v1.JournalInvoiceDayOfWeek)
Enum: 0 1 2 3 4 5 6
Day of the week to generate journal invoice. Only applicable when 'journalInvoicePeriodType' is set to 2(EveryWeek).

0: Sunday
1: Monday
2: Tuesday
3: Wednesday
4: Thursday
5: Friday
6: Saturday
customerName
string or null <= 250 characters
The journal invoice customer name.

customerReference
string or null <= 250 characters
The journal invoice customer reference.

invoiceNumberExternalFormat
string or null <= 100 characters
The journal invoice number format.
Own invoice number can contain automatically filled in values like {VATYear}, {VATPeriod}, {InvoiceNumber}, {DateDay}, {DateMonth}, {DateYear} or {DateShortYear} (more info can be found in the FAQ on the website of Scrada). If you want that a value has minimum length then you can use the value format {::}. The default filling char 0 is used. Samples are '{VATYear}{VATPeriod:2}' or 'V1/{InvoiceNumber:8}'.

invoiceNumberExternalReset
string or null <= 10 characters
Reset the journal invoice number on a specified day.
Format of values is /. Sample 1/5 if reset on the first of May.

openOnMonday
boolean or null
Business is opened on Monday. Default value is true.

openOnTuesday
boolean or null
Business is opened on Tuesday. Default value is true.

openOnWednesday
boolean or null
Business is opened on Wednesday. Default value is true.

openOnThursday
boolean or null
Business is opened on Thursday. Default value is true.

openOnFriday
boolean or null
Business is opened on Friday. Default value is true.

openOnSaturday
boolean or null
Business is opened on Saturday. Default value is true.

openOnSunday
boolean or null
Business is opened on Sunday. Default value is true.

emailNoLinesDays
integer or null <int32> [ 1 .. 1000 ]
Send an email after this number of days no lines entered.

allowMultipleEntries
boolean or null
Allow multiple entries on a single day in the daily receipts book. This doesn't include correction entries.

autoLoadPaymentProvider
boolean or null
If value is true then the payment providers (like payconiq, ... ) are filled in automatically when adding manual lines. Default value true.

addFiguresUser
integer <int32> (v1.JournalAllowAddFiguresUserType)
Enum: 1 2
Allow users to add entries to the journal.

1: Block
2: Directly add figures
addFiguresApi
integer <int32> (v1.JournalAllowAddFiguresApiType)
Enum: 1 2 3 4 5
Allow API users to add entries to the journal.

1: Block
2: Directly add figures
3: Directly add daily receipts figures and add payment methods as proposal
4: Add as proposal (requires confirmation by user)
5: Add as proposal and update with payment provider info
Responses
200 Added journal ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/journal

Request samples
Payload
Content type

application/json
application/json

Copy
{
"active": true,
"name": "string",
"startDate": "2019-08-24T14:15:22Z",
"endDate": "2019-08-24T14:15:22Z",
"invoiceGenerationPeriodType": 1,
"invoiceGenerationStartWeekDay": 0,
"customerName": "string",
"customerReference": "string",
"invoiceNumberExternalFormat": "string",
"invoiceNumberExternalReset": "string",
"openOnMonday": true,
"openOnTuesday": true,
"openOnWednesday": true,
"openOnThursday": true,
"openOnFriday": true,
"openOnSaturday": true,
"openOnSunday": true,
"emailNoLinesDays": 1,
"allowMultipleEntries": true,
"autoLoadPaymentProvider": true,
"addFiguresUser": 1,
"addFiguresApi": 1
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Get journal
Get the specified journal.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Journal.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/journal/{journalID}

Response samples
200500
Content type
application/json

Copy
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"active": true,
"name": "string",
"startDate": "2019-08-24T14:15:22Z",
"endDate": "2019-08-24T14:15:22Z",
"lastLineDate": "2019-08-24T14:15:22Z",
"lastLineID": "16c2f113-478e-4b3a-8e6e-b0c5a0627baa",
"invoiceGenerationPeriodType": 1,
"invoiceGenerationStartWeekDay": 0,
"customerName": "string",
"customerReference": "string",
"invoiceNumberExternalFormat": "string",
"invoiceNumberExternalReset": "string",
"openOnMonday": true,
"openOnTuesday": true,
"openOnWednesday": true,
"openOnThursday": true,
"openOnFriday": true,
"openOnSaturday": true,
"openOnSunday": true,
"cashbookID": "da76995c-8bdc-4961-ae83-c79ba4470dba",
"emailNoLinesDays": 1,
"allowMultipleEntries": true,
"autoLoadPaymentProvider": true,
"addFiguresUser": 1,
"addFiguresApi": 1,
"invoicedTill": "2019-08-24T14:15:22Z",
"paidTill": "2019-08-24T14:15:22Z",
"minimumPossibleLineDate": "2019-08-24T14:15:22Z",
"maximumPossibleLineDate": "2019-08-24T14:15:22Z"
}
Update journal
Update an existing journal.
If a property of the journal is set null or a property is missing then the system assumes that this property must keep its original value. Only in case of property endDate, if this property is missing or has value null, the system assumes that it has value null.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
active
boolean or null
Show the journal in the dashboard.

name
required
string or null
The journal name.

startDate
string or null <date-time>
The start date. If new book and not specified then today is used as start date.

endDate
string or null <date-time>
The closing date.

invoiceGenerationPeriodType
integer <int32> (v1.JournalInvoicePeriodType)
Enum: 1 2 3
The invoice generation period.

1: Every day
2: Every week
3: Every month
invoiceGenerationStartWeekDay
integer <int32> (v1.JournalInvoiceDayOfWeek)
Enum: 0 1 2 3 4 5 6
Day of the week to generate journal invoice. Only applicable when 'journalInvoicePeriodType' is set to 2(EveryWeek).

0: Sunday
1: Monday
2: Tuesday
3: Wednesday
4: Thursday
5: Friday
6: Saturday
customerName
string or null <= 250 characters
The journal invoice customer name.

customerReference
string or null <= 250 characters
The journal invoice customer reference.

invoiceNumberExternalFormat
string or null <= 100 characters
The journal invoice number format.
Own invoice number can contain automatically filled in values like {VATYear}, {VATPeriod}, {InvoiceNumber}, {DateDay}, {DateMonth}, {DateYear} or {DateShortYear} (more info can be found in the FAQ on the website of Scrada). If you want that a value has minimum length then you can use the value format {::}. The default filling char 0 is used. Samples are '{VATYear}{VATPeriod:2}' or 'V1/{InvoiceNumber:8}'.

invoiceNumberExternalReset
string or null <= 10 characters
Reset the journal invoice number on a specified day.
Format of values is /. Sample 1/5 if reset on the first of May.

openOnMonday
boolean or null
Business is opened on Monday. Default value is true.

openOnTuesday
boolean or null
Business is opened on Tuesday. Default value is true.

openOnWednesday
boolean or null
Business is opened on Wednesday. Default value is true.

openOnThursday
boolean or null
Business is opened on Thursday. Default value is true.

openOnFriday
boolean or null
Business is opened on Friday. Default value is true.

openOnSaturday
boolean or null
Business is opened on Saturday. Default value is true.

openOnSunday
boolean or null
Business is opened on Sunday. Default value is true.

emailNoLinesDays
integer or null <int32> [ 1 .. 1000 ]
Send an email after this number of days no lines entered.

allowMultipleEntries
boolean or null
Allow multiple entries on a single day in the daily receipts book. This doesn't include correction entries.

autoLoadPaymentProvider
boolean or null
If value is true then the payment providers (like payconiq, ... ) are filled in automatically when adding manual lines. Default value true.

addFiguresUser
integer <int32> (v1.JournalAllowAddFiguresUserType)
Enum: 1 2
Allow users to add entries to the journal.

1: Block
2: Directly add figures
addFiguresApi
integer <int32> (v1.JournalAllowAddFiguresApiType)
Enum: 1 2 3 4 5
Allow API users to add entries to the journal.

1: Block
2: Directly add figures
3: Directly add daily receipts figures and add payment methods as proposal
4: Add as proposal (requires confirmation by user)
5: Add as proposal and update with payment provider info
Responses
200 Journal successfully updated.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/journal/{journalID}

Request samples
Payload
Content type

application/json
application/json

Copy
{
"active": true,
"name": "string",
"startDate": "2019-08-24T14:15:22Z",
"endDate": "2019-08-24T14:15:22Z",
"invoiceGenerationPeriodType": 1,
"invoiceGenerationStartWeekDay": 0,
"customerName": "string",
"customerReference": "string",
"invoiceNumberExternalFormat": "string",
"invoiceNumberExternalReset": "string",
"openOnMonday": true,
"openOnTuesday": true,
"openOnWednesday": true,
"openOnThursday": true,
"openOnFriday": true,
"openOnSaturday": true,
"openOnSunday": true,
"emailNoLinesDays": 1,
"allowMultipleEntries": true,
"autoLoadPaymentProvider": true,
"addFiguresUser": 1,
"addFiguresApi": 1
}
Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Link journal to cash book
Link an existing journal to an existing cash book. To remove an existing link between a journal and cashbook set the cash book ID to NULL.
When experiencing unsupported media type errors with the cash book ID (body) NULL add a 'Content-Type' header with value application/json.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
The cash book ID or NULL to remove the link.

string <uuid>
Responses
200 Journal successfully linked to cash book.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/journal/{journalID}/link

Request samples
Payload
Content type

application/json
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Payment method
Get all payment methods
Get all payment methods belonging to this journal.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Payment methods.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/journal/{journalID}/paymentMethod

Response samples
200500
Content type
application/json

Copy
Expand allCollapse all
[
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"isCash": true,
"position": 0,
"isCalculated": true,
"isDefault": true,
"inputEntry": 1,
"inputCorrection": 1,
"commentType": 1,
"allowMultiple": true
}
]
Create payment method
Add a new journal payment method.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
nameNL
required
string or null <= 200 characters
The Dutch payment method name.

nameEN
required
string or null <= 200 characters
The English payment method name.

nameFR
required
string or null <= 200 characters
The French payment method name.

nameDE
required
string or null <= 200 characters
The German payment method name.

isCash
boolean or null
Mark the payment method as cash payment. Cash payments will get added to the linked cashbook.

position
integer or null <int32>
The sorting position. Lowest is shown first.

isCalculated
boolean or null
Sets whether this payment method gets calculated in the GUI.

isDefault
boolean or null
Indicator for the default payment method.

inputEntry
integer <int32> (v1.JournalPaymentMethodInputType)
Enum: 1 2 3 4 5 6 7
The input visibility.

1: Not visible
2: Always visible
3: Only positive
4: Only negative
5: Warning on positive
6: Warning on negative
7: Always warning
inputCorrection
integer <int32> (v1.JournalPaymentMethodInputType)
Enum: 1 2 3 4 5 6 7
The input visibility.

1: Not visible
2: Always visible
3: Only positive
4: Only negative
5: Warning on positive
6: Warning on negative
7: Always warning
commentType
integer <int32> (v1.JournalPaymentMethodCommentType)
Enum: 1 2 3
The comment visibility.

1: Not visible
2: Optional
3: Required
allowMultiple
boolean or null
Whether to allow multiple instances of this payment method in a singe daily receipt transaction. Default false, cannot be used in combination with a payment provider integration.

Responses
200 Added payment method ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/journal/{journalID}/paymentMethod

Request samples
Payload
Content type

application/json
application/json

Copy
{
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"isCash": true,
"position": 0,
"isCalculated": true,
"isDefault": true,
"inputEntry": 1,
"inputCorrection": 1,
"commentType": 1,
"allowMultiple": true
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Get payment method
Get the specified journal payment method.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
paymentMethodID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Payment method.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/journal/{journalID}/paymentMethod/{paymentMethodID}

Response samples
200500
Content type
application/json

Copy
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"isCash": true,
"position": 0,
"isCalculated": true,
"isDefault": true,
"inputEntry": 1,
"inputCorrection": 1,
"commentType": 1,
"allowMultiple": true
}
Update payment method
Update an existing journal payment method.
If a property of the journal payment method is set null or a property is missing then the system assumes that this property must keep its original value.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
paymentMethodID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
nameNL
required
string or null <= 200 characters
The Dutch payment method name.

nameEN
required
string or null <= 200 characters
The English payment method name.

nameFR
required
string or null <= 200 characters
The French payment method name.

nameDE
required
string or null <= 200 characters
The German payment method name.

isCash
boolean or null
Mark the payment method as cash payment. Cash payments will get added to the linked cashbook.

position
integer or null <int32>
The sorting position. Lowest is shown first.

isCalculated
boolean or null
Sets whether this payment method gets calculated in the GUI.

isDefault
boolean or null
Indicator for the default payment method.

inputEntry
integer <int32> (v1.JournalPaymentMethodInputType)
Enum: 1 2 3 4 5 6 7
The input visibility.

1: Not visible
2: Always visible
3: Only positive
4: Only negative
5: Warning on positive
6: Warning on negative
7: Always warning
inputCorrection
integer <int32> (v1.JournalPaymentMethodInputType)
Enum: 1 2 3 4 5 6 7
The input visibility.

1: Not visible
2: Always visible
3: Only positive
4: Only negative
5: Warning on positive
6: Warning on negative
7: Always warning
commentType
integer <int32> (v1.JournalPaymentMethodCommentType)
Enum: 1 2 3
The comment visibility.

1: Not visible
2: Optional
3: Required
allowMultiple
boolean or null
Whether to allow multiple instances of this payment method in a singe daily receipt transaction. Default false, cannot be used in combination with a payment provider integration.

Responses
200 Payment method successfully updated.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/journal/{journalID}/paymentMethod/{paymentMethodID}

Request samples
Payload
Content type

application/json
application/json

Copy
{
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"isCash": true,
"position": 0,
"isCalculated": true,
"isDefault": true,
"inputEntry": 1,
"inputCorrection": 1,
"commentType": 1,
"allowMultiple": true
}
Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
VAT category
Get all VAT categories
Get all VAT categories belonging to this journal.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 VAT Categories.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/journal/{journalID}/vatCategory

Response samples
200500
Content type
application/json

Copy
Expand allCollapse all
[
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"vatTypeID": "5d348dc4-4d2d-4cb9-972e-4f14233d67f0",
"position": 0,
"inputEntry": 1,
"inputCorrection": 1,
"commentType": 1,
"accountingGeneralLedger": "string",
"accountingAnalytical1": "string",
"accountingAnalytical2": "string",
"accountingAnalytical3": "string",
"accountingAnalytical4": "string",
"accountingAnalytical5": "string"
}
]
Create VAT category
Add a new journal VAT category.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
nameNL
required
string or null <= 200 characters
The Dutch VAT category name.

nameEN
required
string or null <= 200 characters
The English VAT category name.

nameFR
required
string or null <= 200 characters
The French VAT category name.

nameDE
required
string or null <= 200 characters
The German VAT category name.

vatTypeID
string or null <uuid>
VAT type ID of the category.
Belgium:

cbff0b5e-96e3-4201-91d0-51304cee2605: 00 (0%) VAT
7befe0fc-7131-4b15-9fe6-ca4b9280b63c: 01 (6%) VAT
647ed17b-fb6f-4772-baf5-928de98f4db1: 02 (12%) VAT
8424d909-78b9-483c-9b1d-4584fb537846: 03 (21%) VAT
cc9b638f-3b54-44c8-91e5-83d337ae6591: NA
The Netherlands:
fb145f3f-c866-4322-9169-8d8219d40e8a: 00 (0%) VAT
3aa951e7-f307-4902-b315-b764eb81d211: 02 (9%) VAT
aeb8b26c-00b1-4c6a-9cf2-bc1c71d89196: 03 (21%) VAT
a29f353e-5549-460a-97cb-70a607b28581: NA
Luxembourg:
1693aca4-a715-4543-be5d-64f0210f0078: 00 (0%) VAT
03120fb9-18ea-43a1-9119-1af511895e28: 01 (3%) VAT
3f3556ee-6afb-43d1-9545-d309087ac461: 02 (8%) VAT
d5b9db32-49d7-4929-9e60-dec7b00c2e2f: 03 (14%) VAT
e701b521-2ff0-4176-9533-3e297d52809e: 04 (17%) VAT
ea73a071-18dd-4964-8fd7-fe58ff782c2c: NA
position
integer or null <int32>
The sorting position. Lowest is shown first.

inputEntry
integer <int32> (v1.JournalVatCategoryInputType)
Enum: 1 2 3 4 5 6 7
The input visibility.

1: Not visible
2: Always visible
3: Only positive
4: Only negative
5: Warning on positive
6: Warning on negative
7: Always warning
inputCorrection
integer <int32> (v1.JournalVatCategoryInputType)
Enum: 1 2 3 4 5 6 7
The input visibility.

1: Not visible
2: Always visible
3: Only positive
4: Only negative
5: Warning on positive
6: Warning on negative
7: Always warning
commentType
integer <int32> (v1.JournalVatCategoryCommentType)
Enum: 1 2 3
The comment visibility.

1: Not visible
2: Optional
3: Required
accountingGeneralLedger
string or null
The accounting general ledger number. Must be empty or fully numeric.

accountingAnalytical1
string or null
The accounting analytical 1. Function depends on the accounting system.

accountingAnalytical2
string or null
The accounting analytical 2. Function depends on the accounting system.

accountingAnalytical3
string or null
The accounting analytical 3. Function depends on the accounting system.

accountingAnalytical4
string or null
The accounting analytical 4. Function depends on the accounting system.

accountingAnalytical5
string or null
The accounting analytical 5. Function depends on the accounting system.

Responses
200 Added VAT category ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/journal/{journalID}/vatCategory

Request samples
Payload
Content type

application/json
application/json

Copy
{
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"vatTypeID": "5d348dc4-4d2d-4cb9-972e-4f14233d67f0",
"position": 0,
"inputEntry": 1,
"inputCorrection": 1,
"commentType": 1,
"accountingGeneralLedger": "string",
"accountingAnalytical1": "string",
"accountingAnalytical2": "string",
"accountingAnalytical3": "string",
"accountingAnalytical4": "string",
"accountingAnalytical5": "string"
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Get VAT category
Get the specified journal VAT category.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
vatCategoryID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 VAT category.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/journal/{journalID}/vatCategory/{vatCategoryID}

Response samples
200500
Content type
application/json

Copy
{
"id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"vatTypeID": "5d348dc4-4d2d-4cb9-972e-4f14233d67f0",
"position": 0,
"inputEntry": 1,
"inputCorrection": 1,
"commentType": 1,
"accountingGeneralLedger": "string",
"accountingAnalytical1": "string",
"accountingAnalytical2": "string",
"accountingAnalytical3": "string",
"accountingAnalytical4": "string",
"accountingAnalytical5": "string"
}
Update VAT category
Update an existing journal VAT category.
If a property of the journal VAT category is set null or a property is missing then the system assumes that this property must keep its original value.

path Parameters
companyID
required
string <uuid>
journalID
required
string <uuid>
vatCategoryID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
nameNL
required
string or null <= 200 characters
The Dutch VAT category name.

nameEN
required
string or null <= 200 characters
The English VAT category name.

nameFR
required
string or null <= 200 characters
The French VAT category name.

nameDE
required
string or null <= 200 characters
The German VAT category name.

vatTypeID
string or null <uuid>
VAT type ID of the category.
Belgium:

cbff0b5e-96e3-4201-91d0-51304cee2605: 00 (0%) VAT
7befe0fc-7131-4b15-9fe6-ca4b9280b63c: 01 (6%) VAT
647ed17b-fb6f-4772-baf5-928de98f4db1: 02 (12%) VAT
8424d909-78b9-483c-9b1d-4584fb537846: 03 (21%) VAT
cc9b638f-3b54-44c8-91e5-83d337ae6591: NA
The Netherlands:
fb145f3f-c866-4322-9169-8d8219d40e8a: 00 (0%) VAT
3aa951e7-f307-4902-b315-b764eb81d211: 02 (9%) VAT
aeb8b26c-00b1-4c6a-9cf2-bc1c71d89196: 03 (21%) VAT
a29f353e-5549-460a-97cb-70a607b28581: NA
Luxembourg:
1693aca4-a715-4543-be5d-64f0210f0078: 00 (0%) VAT
03120fb9-18ea-43a1-9119-1af511895e28: 01 (3%) VAT
3f3556ee-6afb-43d1-9545-d309087ac461: 02 (8%) VAT
d5b9db32-49d7-4929-9e60-dec7b00c2e2f: 03 (14%) VAT
e701b521-2ff0-4176-9533-3e297d52809e: 04 (17%) VAT
ea73a071-18dd-4964-8fd7-fe58ff782c2c: NA
position
integer or null <int32>
The sorting position. Lowest is shown first.

inputEntry
integer <int32> (v1.JournalVatCategoryInputType)
Enum: 1 2 3 4 5 6 7
The input visibility.

1: Not visible
2: Always visible
3: Only positive
4: Only negative
5: Warning on positive
6: Warning on negative
7: Always warning
inputCorrection
integer <int32> (v1.JournalVatCategoryInputType)
Enum: 1 2 3 4 5 6 7
The input visibility.

1: Not visible
2: Always visible
3: Only positive
4: Only negative
5: Warning on positive
6: Warning on negative
7: Always warning
commentType
integer <int32> (v1.JournalVatCategoryCommentType)
Enum: 1 2 3
The comment visibility.

1: Not visible
2: Optional
3: Required
accountingGeneralLedger
string or null
The accounting general ledger number. Must be empty or fully numeric.

accountingAnalytical1
string or null
The accounting analytical 1. Function depends on the accounting system.

accountingAnalytical2
string or null
The accounting analytical 2. Function depends on the accounting system.

accountingAnalytical3
string or null
The accounting analytical 3. Function depends on the accounting system.

accountingAnalytical4
string or null
The accounting analytical 4. Function depends on the accounting system.

accountingAnalytical5
string or null
The accounting analytical 5. Function depends on the accounting system.

Responses
200 VAT category successfully updated.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/journal/{journalID}/vatCategory/{vatCategoryID}

Request samples
Payload
Content type

application/json
application/json

Copy
{
"nameNL": "string",
"nameEN": "string",
"nameFR": "string",
"nameDE": "string",
"vatTypeID": "5d348dc4-4d2d-4cb9-972e-4f14233d67f0",
"position": 0,
"inputEntry": 1,
"inputCorrection": 1,
"commentType": 1,
"accountingGeneralLedger": "string",
"accountingAnalytical1": "string",
"accountingAnalytical2": "string",
"accountingAnalytical3": "string",
"accountingAnalytical4": "string",
"accountingAnalytical5": "string"
}
Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Peppol
Participant lookup
Search for a participant on the Peppol network. The businessEntity can be NULL if this information is not published on the Peppol network.

path Parameters
companyID
required
string <uuid>
scheme
required
string
The scheme. Sample: iso6523-actorid-upis

id
required
string
The id exists of 2 parts separated by a colon. The first part is the type (Participant Identifier Scheme at https://docs.peppol.eu/edelivery/codelists/) and the second part is the value. Sample: 0208:0793904121

header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Peppol party information.
401 Unauthorized. The API Key and/or Password is wrong.
404 Participant not found on Peppol.
429 Too many requests. Please try again later.
500 An error occurred.
503 Participant access point unavailable.

get
/v1/company/{companyID}/peppol/lookup/{scheme}/{id}

Response samples
200500
Content type
application/json

Copy
Expand allCollapse all
{
"participantIdentifier": {
"scheme": "string",
"id": "string"
},
"businessEntity": {
"name": "string",
"languageCode": "st",
"countryCode": "st"
},
"documentTypes": [
{}
]
}
Party lookup (JSON)
Search for a participant on the Peppol network with a invoice customer or supplier object. This will check if Scrada is able to send a document to the given party.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
peppolID
string or null
The Peppol ID of the customer. If this is set then the invoice is sent to this ID on peppol if this ID is registered on Peppol and in Scrada it is configured to send invoice over Peppol. Example: 0208:0793904121

code
string or null
The customer identification code.

accountingCode
string or null
The customer identification code in the accounting system. This code is used as reference key to this party.

languageCode
string or null <= 2 characters
The customer language code according to ISO 639-1.

name
required
string
The customer name.

address
required
object (Address)
phone
string or null <= 50 characters
The customer phone number.

email
string or null <= 250 characters
The customer email address.

invoiceEmail
string or null <= 250 characters
The customer invoice email address.

contact
string or null
The customer contact name.

taxNumberType
integer <int32> (v1.CompanyInvoiceTaxNumberType)
Enum: 1 2 3 5
The tax number typed used to identify the party.

1: Numero d'entreprise / ondernemingsnummer / Unternehmensnummer / Enterprise number (Belgium)
2: Kamer van koophandel nummer (the Netherlands)
3: SIRENE (France)
5: Organisatie-Identificatienummer [OIN] (the Netherlands, must be 20 digits)
taxNumber
string or null
The customer tax number according to the taxNumberType.

vatNumber
string or null
The customer VAT number. This must be a valid VAT number!

glnNumber
string or null
The customer GLN number. This must be a valid GLN number!

extraIdentifiers
Array of objects or null (Extra party identifier information)
Extra identifiers for the customer.

Responses
200 Peppol party information.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.
503 Participant access point unavailable.

post
/v1/company/{companyID}/peppol/lookup

Request samples
Payload
Content type

application/json
application/json

Copy
Expand allCollapse all
{
"peppolID": "string",
"code": "string",
"accountingCode": "string",
"languageCode": "st",
"name": "string",
"address": {
"street": "string",
"streetNumber": "string",
"streetBox": "string",
"city": "string",
"zipCode": "string",
"countrySubentity": "string",
"countryCode": "st"
},
"phone": "string",
"email": "string",
"invoiceEmail": "string",
"contact": "string",
"taxNumberType": 1,
"taxNumber": "string",
"vatNumber": "string",
"glnNumber": "string",
"extraIdentifiers": [
{}
]
}
Response samples
200500
Content type
application/json

Copy
{
"registered": true,
"supportInvoice": true,
"supportCreditInvoice": true,
"supportSelfBillingInvoice": true,
"supportSelfBillingCreditInvoice": true
}
Peppol inbound
Register company
Register a company on the Peppol network to receive documents. Only possible to call this function if you have a Peppol Only subscription.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
participantIdentifier
required
object (Peppol participant identifier)
businessEntity
required
object (Business information)
documentTypes
required
Array of objects or null (The Peppol document type)
The accepted document types.

migrationKey
string or null
Optional migration key to transfer the Peppol registration from another Peppol access point to Scrada Peppol access point. If you are already registered at another Peppol access point and you want to register at Scrada, you have to deregister at the other access point or request a migration key from them. The advantage of a migration key is that you can always continue to receive documents.

Responses
200 Company successfully registered on Peppol. The GUID of the registered company is returned.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/peppol/register

Request samples
Payload
Content type

application/json
application/json

Copy
Expand allCollapse all
{
"participantIdentifier": {
"scheme": "string",
"id": "string"
},
"businessEntity": {
"name": "string",
"languageCode": "st",
"countryCode": "st"
},
"documentTypes": [
{}
],
"migrationKey": "string"
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Deregister company
Deregister a company on the Peppol network to receive documents. Only possible to call this function if you have a Peppol Only subscription.

path Parameters
companyID
required
string <uuid>
participantIdentifierScheme
required
string
participantIdentifierValue
required
string
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Company successfully deregistered from Peppol.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

delete
/v1/company/{companyID}/peppol/deregister/{participantIdentifierScheme}/{participantIdentifierValue}

Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Get unconfirmed inbound documents
Get all unconfirmed documents received from Peppol. To confirm a document use the Confirm inbound document endpoint.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Inbound documents.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/peppol/inbound/document/unconfirmed

Response samples
200500
Content type
application/json

Copy
Expand allCollapse all
{
"results": [
{}
],
"\_\_count": 0
}
Get inbound document
Get the inbound Peppol document. The HTTP headers will contain the following information.

Header Description Example
x-scrada-document-id Scrada document ID 497f6eca-6276-4993-bfeb-53cbbbba6f08
x-scrada-internal-number Scrada internal document number 1
x-scrada-peppol-sender-scheme Sender party scheme iso6523-actorid-upis
x-scrada-peppol-sender-id Sender party ID 0208:0000000097
x-scrada-peppol-receiver-scheme Receiver party scheme iso6523-actorid-upis
x-scrada-peppol-receiver-id Receiver party ID 0208:0000000097
x-scrada-peppol-c1-country-code The country code where the sender party is legally present BE
x-scrada-peppol-c2-timestamp The timestamp when the document was send 2022-12-31T08:00:00.000Z
x-scrada-peppol-c2-seat-id The Peppol seat ID of the sending access point PBE000001
x-scrada-peppol-c2-message-id The message ID of the sending access point 497f6eca-6276-4993-bfeb-53cbbbba6f08@scrada
x-scrada-peppol-c3-incoming-unique-id The incoming unique message ID at the receiving access point 497f6eca-6276-4993-bfeb-53cbbbba6f08
x-scrada-peppol-c3-message-id The message ID of the receiving access point 497f6eca-6276-4993-bfeb-53cbbbba6f08@scrada
x-scrada-peppol-conversation-id The conversation ID 497f6eca-6276-4993-bfeb-53cbbbba6f08
x-scrada-peppol-sbdh-instance-identifier The SBDH instance ID 497f6eca-6276-4993-bfeb-53cbbbba6f08
x-scrada-peppol-document-type-scheme The document type scheme used busdox-docid-qns
x-scrada-peppol-document-type-value The document type used urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1
x-scrada-peppol-process-scheme The process scheme used cenbii-procid-ubl
x-scrada-peppol-process-value The process used urn:fdc:peppol.eu:2017:poacc:billing:01:1.0
path Parameters
companyID
required
string <uuid>
documentID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Inbound document.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/peppol/inbound/document/{documentID}

Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Get PDF of inbound document
Returns a PDF version of the inbound document.
In case of a purchase invoice, a formatted invoice PDF is generated.
Otherwise, the raw UBL/XML document is converted into a simple PDF representation.

path Parameters
companyID
required
string <uuid>
documentID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Generated PDF document
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/peppol/inbound/document/{documentID}/pdf

Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Confirm inbound document
Confirm the successful reception of an inbound document. This allows you to retrieve the following new inbound document with the Get unconfirmed inbound documents endpoint.

path Parameters
companyID
required
string <uuid>
documentID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 Document confirmed.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

put
/v1/company/{companyID}/peppol/inbound/document/{documentID}/confirm

Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Peppol outbound
Send document
Sends a document over the Peppol network. Only possible to call this function if you have a Peppol Only subscription.
Only XML documents can be sent over Peppol using this API. Send the document with content type application/xml or text/xml. Default charset that is used is utf-8.

path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

x-scrada-peppol-sender-scheme
required
string
The sender party scheme. Example: iso6523-actorid-upis

x-scrada-peppol-sender-id
required
string
The sender party ID. Example: 0208:0000000097

x-scrada-peppol-receiver-scheme
required
string
The receiver party scheme. Example: iso6523-actorid-upis

x-scrada-peppol-receiver-id
required
string
The receiver party ID. Example: 0208:0000000097

x-scrada-peppol-c1-country-code
required
string
The country code where the sender party is legally present. Example: BE

x-scrada-peppol-document-type-scheme
required
string
The document type scheme used. Example: busdox-docid-qns

x-scrada-peppol-document-type-value
required
string
The document type used. Example: urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1

x-scrada-peppol-process-scheme
required
string
The process scheme used. Example: cenbii-procid-ubl

x-scrada-peppol-process-value
required
string
The process used. Example: urn:fdc:peppol.eu:2017:poacc:billing:01:1.0

x-scrada-external-reference
string
The reference you give to the document. This header is not required. This is not used for Peppol but is used in the portal of Scrada and in the webhooks. Example: V1/202400512

Responses
200 Added document ID.
401 Unauthorized. The API Key and/or Password is wrong.
415 Unsupported media type. The content (or content-type header) is not of the type XML.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/peppol/outbound/document

Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Send sales invoice
Sends a sales invoice in JSON format to Scrada that will be converted by Scrada to a Peppol document and sent over the Peppol network. Only possible to call this function if you have a Peppol Only subscription.
If a property is set null or a property is missing then we assume that this property must keep its original value.

VAT inclusive or exclusive
It is possible to enter the item pricing including or excluding VAT to reduce issues with VAT rounding.

Excluding VAT (Default)
Set `isInclVat` to false or omit from the JSON
Enter the `lines`.`itemExclVat`
Enter the `lines`.`totalExclVat`
When applicable enter the `lines`.`totalDiscountExclVat`
Omit any ...InclVat value in `lines`
Including VAT
Set `isInclVat` to true
Enter the `lines`.`itemInclVat`
Enter the `lines`.`totalInclVat`
When applicable enter the `lines`.`totalDiscountInclVat`
Omit any ...ExclVat value in `lines`
Validation rules

The sum of all `lines.totalExclVat` must exactly match:
the sum of all `vatTotals`.`totalExclVat`
the invoice `totalExclVat`
VAT amounts in `vatTotals`.`totalVat` may only have a minimal deviation from calculated VAT based on line totals.
`totalInclVat` must equal `totalExclVat` + `totalVat`
Receiver identifier resolution
The receiver Peppol ID is resolved by Scrada based on the following fields (in order of priority). The first available value will be used:

`customer`.`peppolID`
`customer`.`glnNumber`
`customer`.`taxNumber`
`customer`.`vatNumber`
path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
number
required
string [ 1 .. 250 ] characters
The invoice number.

externalReference
string or null
The reference you give to the invoice. This is not required. This is not used for Peppol but is used in the portal of Scrada and in the webhooks.

creditInvoice
boolean or null
The invoice is a credit invoice. Default value is false.

isInclVat
boolean or null
The invoice is including VAT. Default value is false.

invoiceReference
string or null <= 250 characters
The invoice or credit note to which this document refers. This is not required. For example, in the case of a credit note, this is the invoice number credited by the credit note.

invoiceDate
required
string <date>
The invoice date.

invoiceExpiryDate
string or null <date>
The invoice expiry date.

accountingCost
string or null
The buyer accounting reference.

buyerReference
string or null
The buyer's reference.

purchaseOrderReference
string or null
The purchase order reference.

salesOrderReference
string or null
The sales order reference.

despatchDocumentReference
string or null
The despatch document reference.

projectReference
string or null
The project reference, this is only allowed for an invoice.

supplier
required
object (Invoice party)
customer
required
object (Invoice party)
delivery
object (Sales invoice delivery)
totalExclVat
required
number <double>
The total invoice amount excluding VAT. Default value is 0. Max precision is 2.

totalInclVat
required
number <double>
The total invoice amount including VAT. Default value is 0. Max precision is 2.

totalVat
required
number <double>
The total invoice VAT amount. Default value is 0. Max precision is 2.

currency
string or null <= 3 characters
The currency of the invoice according to ISO 4217. Default value is EUR.

payableRoundingAmount
number or null <double>
The payable rounding amount. The amount to be added to the invoice total to round the amount to be paid. Max precision is 2.

note
string or null
The invoice comment.

lines
required
Array of objects (Invoice line)
The invoice lines.

vatTotals
required
Array of objects (Sales invoice VAT total)
The VAT totals.

paymentTerms
string or null
The payment terms for the invoice. Example: Net within 30 days.

paymentMethods
Array of objects (Invoice payment method)
The payment methods.

attachments
Array of objects or null (Invoice attachment)
The attachments related to the invoice.

Responses
200 Added document ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/peppol/outbound/salesInvoice

Request samples
Payload
Content type

application/json
application/json

Copy
Expand allCollapse all
{
"number": "string",
"externalReference": "string",
"creditInvoice": true,
"isInclVat": true,
"invoiceReference": "string",
"invoiceDate": "2019-08-24",
"invoiceExpiryDate": "2019-08-24",
"accountingCost": "string",
"buyerReference": "string",
"purchaseOrderReference": "string",
"salesOrderReference": "string",
"despatchDocumentReference": "string",
"projectReference": "string",
"supplier": {
"peppolID": "string",
"code": "string",
"languageCode": "st",
"name": "string",
"address": {},
"phone": "string",
"email": "string",
"invoiceEmail": "string",
"contact": "string",
"vatStatus": 1,
"taxNumberType": 1,
"taxNumber": "string",
"legalPersonRegister": "string",
"vatNumber": "string",
"glnNumber": "string",
"extraIdentifiers": []
},
"customer": {
"peppolID": "string",
"code": "string",
"languageCode": "st",
"name": "string",
"address": {},
"phone": "string",
"email": "string",
"invoiceEmail": "string",
"contact": "string",
"vatStatus": 1,
"taxNumberType": 1,
"taxNumber": "string",
"legalPersonRegister": "string",
"vatNumber": "string",
"glnNumber": "string",
"extraIdentifiers": []
},
"delivery": {
"deliveryDate": "2019-08-24",
"address": {},
"identifierType": 1,
"identifier": "string"
},
"totalExclVat": 0,
"totalInclVat": 0,
"totalVat": 0,
"currency": "str",
"payableRoundingAmount": 0,
"note": "string",
"lines": [
{}
],
"vatTotals": [
{}
],
"paymentTerms": "string",
"paymentMethods": [
{}
],
"attachments": [
{}
]
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Send self-billing invoice
Sends a self-billing invoice or credit note in JSON format to Scrada that will be converted by Scrada to a Peppol document and sent over the Peppol network. Only possible to call this function if you have a Peppol Only subscription.
This endpoint supports self-billing, which means that you (the buyer) issue an invoice or credit note on behalf of your supplier. The supplier will receive this document via Peppol and book it as a sales invoice or credit note.

VAT inclusive or exclusive
It is possible to enter the item pricing including or excluding VAT to reduce issues with VAT rounding.

Excluding VAT (Default)
Set `isInclVat` to false or omit from the JSON
Enter the `lines`.`itemExclVat`
Enter the `lines`.`totalExclVat`
When applicable enter the `lines`.`totalDiscountExclVat`
Omit any ...InclVat value in `lines`
Including VAT
Set `isInclVat` to true
Enter the `lines`.`itemInclVat`
Enter the `lines`.`totalInclVat`
When applicable enter the `lines`.`totalDiscountInclVat`
Omit any ...ExclVat value in `lines`
Validation rules

The sum of all `lines.totalExclVat` must exactly match:
the sum of all `vatTotals`.`totalExclVat`
the invoice `totalExclVat`
VAT amounts in `vatTotals`.`totalVat` may only have a minimal deviation from calculated VAT based on line totals.
`totalInclVat` must equal `totalExclVat` + `totalVat`
Receiver identifier resolution
The receiver Peppol ID is resolved by Scrada based on the following fields (in order of priority). The first available value will be used:

`supplier`.`peppolID`
`supplier`.`glnNumber`
`supplier`.`taxNumber`
`supplier`.`vatNumber`
Important: Ensure that the supplier has agreed to self-billing.
path Parameters
companyID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Request Body schema:
application/json
application/json
number
required
string [ 1 .. 250 ] characters
The invoice number.

externalReference
string or null
The reference you give to the invoice. This is not required. This is not used for Peppol but is used in the portal of Scrada and in the webhooks.

creditInvoice
boolean or null
The invoice is a credit invoice. Default value is false.

isInclVat
boolean or null
The invoice is including VAT. Default value is false.

invoiceReference
string or null <= 250 characters
The invoice or credit note to which this document refers. This is not required. For example, in the case of a credit note, this is the invoice number credited by the credit note.

invoiceDate
required
string <date>
The invoice date.

invoiceExpiryDate
string or null <date>
The invoice expiry date.

accountingCost
string or null
The buyer accounting reference.

buyerReference
string or null
The buyer's reference.

purchaseOrderReference
string or null
The purchase order reference.

salesOrderReference
string or null
The sales order reference.

despatchDocumentReference
string or null
The despatch document reference.

projectReference
string or null
The project reference, this is only allowed for an invoice.

supplier
required
object (Invoice party)
customer
required
object (Invoice party)
delivery
object (Sales invoice delivery)
totalExclVat
required
number <double>
The total invoice amount excluding VAT. Default value is 0. Max precision is 2.

totalInclVat
required
number <double>
The total invoice amount including VAT. Default value is 0. Max precision is 2.

totalVat
required
number <double>
The total invoice VAT amount. Default value is 0. Max precision is 2.

currency
string or null <= 3 characters
The currency of the invoice according to ISO 4217. Default value is EUR.

payableRoundingAmount
number or null <double>
The payable rounding amount. The amount to be added to the invoice total to round the amount to be paid. Max precision is 2.

note
string or null
The invoice comment.

lines
required
Array of objects (Invoice line)
The invoice lines.

vatTotals
required
Array of objects (Sales invoice VAT total)
The VAT totals.

paymentTerms
string or null
The payment terms for the invoice. Example: Net within 30 days.

paymentMethods
Array of objects (Invoice payment method)
The payment methods.

attachments
Array of objects or null (Invoice attachment)
The attachments related to the invoice.

Responses
200 Added document ID.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.

post
/v1/company/{companyID}/peppol/outbound/selfBillingInvoice

Request samples
Payload
Content type

application/json
application/json

Copy
Expand allCollapse all
{
"number": "string",
"externalReference": "string",
"creditInvoice": true,
"isInclVat": true,
"invoiceReference": "string",
"invoiceDate": "2019-08-24",
"invoiceExpiryDate": "2019-08-24",
"accountingCost": "string",
"buyerReference": "string",
"purchaseOrderReference": "string",
"salesOrderReference": "string",
"despatchDocumentReference": "string",
"projectReference": "string",
"supplier": {
"peppolID": "string",
"code": "string",
"languageCode": "st",
"name": "string",
"address": {},
"phone": "string",
"email": "string",
"invoiceEmail": "string",
"contact": "string",
"vatStatus": 1,
"taxNumberType": 1,
"taxNumber": "string",
"legalPersonRegister": "string",
"vatNumber": "string",
"glnNumber": "string",
"extraIdentifiers": []
},
"customer": {
"peppolID": "string",
"code": "string",
"languageCode": "st",
"name": "string",
"address": {},
"phone": "string",
"email": "string",
"invoiceEmail": "string",
"contact": "string",
"vatStatus": 1,
"taxNumberType": 1,
"taxNumber": "string",
"legalPersonRegister": "string",
"vatNumber": "string",
"glnNumber": "string",
"extraIdentifiers": []
},
"delivery": {
"deliveryDate": "2019-08-24",
"address": {},
"identifierType": 1,
"identifier": "string"
},
"totalExclVat": 0,
"totalInclVat": 0,
"totalVat": 0,
"currency": "str",
"payableRoundingAmount": 0,
"note": "string",
"lines": [
{}
],
"vatTotals": [
{}
],
"paymentTerms": "string",
"paymentMethods": [
{}
],
"attachments": [
{}
]
}
Response samples
200500
Content type
application/json

Copy
"497f6eca-6276-4993-bfeb-53cbbbba6f08"
Get outbound document
Get the document that was delivered to Scrada using the endpoint Send document or get the successful delivered document over Peppol in case a JSON was delivered to Scrada (the endpoint Send sales invoice). In case of a JSON, only after a successful delivery on Peppol this endpoint can be used to get the delivered document over Peppol (most of the times this is an UBL document).

path Parameters
companyID
required
string <uuid>
documentID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 The outbound document
401 Unauthorized. The API Key and/or Password is wrong.
404 Document not found or document is not successful delivered over Peppol.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/peppol/outbound/document/{documentID}/ubl

Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Get sales invoice UBL document Deprecated
Gets the UBL document of a specific sales invoice. This endpoint is obsolete. Use Get outbound document instead.

path Parameters
companyID
required
string <uuid>
documentID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 The UBL document of the sales invoice
401 Unauthorized. The API Key and/or Password is wrong.
404 Sales invoice not found or no UBL available.
429 Too many requests. Please try again later.
500 An error occurred.

get
/v1/company/{companyID}/peppol/outbound/salesInvoice/{documentID}/ubl

Response samples
500
Content type
application/json

Copy
Expand allCollapse all
{
"errorCode": 0,
"defaultFormat": "string",
"innerErrors": [
{ }
]
}
Get outbound document status
Gets the status of a specific outbound document.

path Parameters
companyID
required
string <uuid>
documentID
required
string <uuid>
header Parameters
Language
string
Language

X-API-KEY
required
string
The API Key.

X-PASSWORD
required
string
The password.

Responses
200 The status of the requested XML document.
401 Unauthorized. The API Key and/or Password is wrong.
429 Too many requests. Please try again later.
500 An error occurred.
