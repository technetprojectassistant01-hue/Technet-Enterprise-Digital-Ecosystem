export const COMPANY = {
  name: "Technet Engineering Ltd",
  addressLines: ["Pont St Louis", "Pailles 11221, Mauritius"],
  vat: "27392600",
  brn: "C15134617",
  tel: "+(230) 286 1100",
  fax: "+(230) 286 7649",
  email: "info@technetengineering.com",
  website: "www.technetengineering.com",
  bank: {
    name: "The Mauritius Commercial Bank Ltd",
    accountName: "Technet Engineering Ltd",
    accountNumber: "000444140808",
  },
  tagline: "Your Engineering Solutions Partner",
};

export const INVOICE_CONDITIONS = [
  "All equipments delivered will remain the property of Technet Engineering Ltd, until full payment is effected.",
  `Bank Details: ${COMPANY.bank.name} | Account Name: ${COMPANY.bank.accountName} | Account Num: ${COMPANY.bank.accountNumber}`,
  "Warranty does not apply: (a) Any product that has been damaged by abuse, misuse, tampering, fire or water, higher than specified voltage electronic disruption, lighting or (b) Damage resulting from damage to case or interior component modules or acts of God.",
  "THE WARRANTY IS VOID IF THE EQUIPMENT IS/ARE ALTERED OR TAMPERED / IMPROPERLY REPAIRED OR SERVICED BY ANY OTHER THAN TECHNET ENGINEERING SERVICE TEAM.",
];

export const QUOTATION_CONDITIONS: { label: string; value: string }[] = [
  { label: "Prices", value: "Inclusive of custom duties where applicable but exclusive of VAT." },
  { label: "Exchange Rate", value: "Not Applicable" },
  {
    label: "Terms of payments",
    value:
      "60% Upon Order confirmation, 40% On Installation & Testing. All equipment delivered will remain the property of Technet Engineering Ltd until full payment is effected.",
  },
  { label: "Delivery period", value: "+/- 3 days" },
  { label: "Validity", value: "15 Calendar days" },
  {
    label: "Responsibility",
    value:
      "Our responsibilities are limited to the covers provided by our insurers at our request. The purchaser must check with us that these are adequate for his purposes. No claim for consequential damages will be entertained unless prior arrangements have been negotiated with our insurers, for account of the purchaser and confirmed in writing in our quotation.",
  },
  {
    label: "Limited Warranty",
    value:
      "Technet Engineering Ltd warrants that the equipment supplied will conform to the manufacturer's published specifications and be free from defects and workmanship (the \"Warranty\"). Should any failure to conform to the Warranty appear, under normal use and service, within the applicable Warranty period specified above, Technet Engineering Ltd shall, upon receiving written notification and substantiation by client, at its option, repair or replace the non-conforming part or parts free of charge. In case of major breakdown, the equipment will go to the manufacturer for repairs and any freight charges incurred will be charged to the client.",
  },
  {
    label: "Warranty Does Not Cover",
    value:
      "The Warranty does not apply (i) any product that has been damaged by abuse, misuse, tampering, fire or water higher than specified voltage, electronic disruption, lighting or (ii) damage resulting from damage to case or interior component modules or acts of God. THE WARRANTY IS VOID IF THE EQUIPMENT IS/ARE ALTERED OR TAMPERED / IMPROPERLY REPAIRED OR SERVICED BY ANYONE OTHER THAN TECHNET'S SERVICE TEAM.",
  },
];
