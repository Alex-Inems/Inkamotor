import type { SettingTab } from "@/lib/settings/types";

/** Full Odoo Settings replica — every tab, section, and control from Inkamoto Tours Odoo 19. */
export const SETTINGS_TABS: SettingTab[] = [
  {
    id: "general",
    titleKey: "tabs.general",
    icon: "general",
    sections: [
      {
        id: "users",
        titleKey: "sections.users",
        items: [
          {
            id: "invite_users",
            titleKey: "items.inviteUsers",
            descKey: "items.inviteUsersDesc",
            fields: [
              { kind: "text", key: "invite_email", placeholderKey: "placeholders.email" },
              { kind: "action", labelKey: "actions.invite" },
              { kind: "info", labelKey: "info.activeUsers" },
              { kind: "action", labelKey: "actions.manageUsers", href: "/contacts" },
            ],
          },
        ],
      },
      {
        id: "languages",
        titleKey: "sections.languages",
        items: [
          {
            id: "languages",
            titleKey: "items.languages",
            descKey: "items.languagesDesc",
            fields: [
              { kind: "info", labelKey: "info.languagesCount" },
              { kind: "action", labelKey: "actions.addLanguages" },
            ],
          },
        ],
      },
      {
        id: "companies",
        titleKey: "sections.companies",
        items: [
          {
            id: "company",
            titleKey: "items.company",
            descKey: "items.companyDesc",
            fields: [
              { kind: "info", labelKey: "info.companyCard" },
              { kind: "action", labelKey: "actions.updateCompany" },
              { kind: "action", labelKey: "actions.manageCompanies" },
            ],
          },
          {
            id: "document_layout",
            titleKey: "items.documentLayout",
            descKey: "items.documentLayoutDesc",
            fields: [{ kind: "action", labelKey: "actions.configureDocumentLayout" }],
          },
          {
            id: "email_templates_style",
            titleKey: "items.emailTemplatesStyle",
            descKey: "items.emailTemplatesStyleDesc",
            fields: [
              { kind: "color", key: "email_btn_text_color" },
              { kind: "color", key: "email_btn_color" },
              { kind: "action", labelKey: "actions.reviewAllTemplates", href: "/email-marketing" },
            ],
          },
        ],
      },
      {
        id: "uom",
        titleKey: "sections.uom",
        items: [
          {
            id: "weight_uom",
            titleKey: "items.weightUom",
            descKey: "items.weightUomDesc",
            fields: [
              {
                kind: "radio",
                key: "weight_uom",
                options: [
                  { value: "kg", labelKey: "options.kg" },
                  { value: "lb", labelKey: "options.lb" },
                ],
              },
            ],
          },
          {
            id: "volume_uom",
            titleKey: "items.volumeUom",
            descKey: "items.volumeUomDesc",
            fields: [
              {
                kind: "radio",
                key: "volume_uom",
                options: [
                  { value: "m3", labelKey: "options.m3" },
                  { value: "ft3", labelKey: "options.ft3" },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "emails",
        titleKey: "sections.emails",
        items: [
          {
            id: "custom_email_servers",
            titleKey: "items.customEmailServers",
            descKey: "items.customEmailServersDesc",
            fields: [
              { kind: "boolean", key: "custom_email_servers" },
              { kind: "action", labelKey: "actions.openSetup", href: "/setup" },
            ],
          },
          {
            id: "alias_domain",
            titleKey: "items.aliasDomain",
            descKey: "items.aliasDomainDesc",
            fields: [
              { kind: "text", key: "alias_domain", placeholderKey: "placeholders.domain", prefix: "@" },
            ],
          },
          {
            id: "email_digest",
            titleKey: "items.emailDigest",
            descKey: "items.emailDigestDesc",
            fields: [
              { kind: "boolean", key: "email_digest" },
              {
                kind: "select",
                key: "email_digest_template",
                options: [
                  { value: "periodic", labelKey: "options.digestPeriodic" },
                  { value: "weekly", labelKey: "options.digestWeekly" },
                  { value: "monthly", labelKey: "options.digestMonthly" },
                ],
              },
              { kind: "action", labelKey: "actions.configureDigests" },
            ],
          },
          {
            id: "restrict_template_rendering",
            titleKey: "items.restrictTemplateRendering",
            descKey: "items.restrictTemplateRenderingDesc",
            fields: [{ kind: "boolean", key: "restrict_template_rendering" }],
          },
        ],
      },
      {
        id: "discuss",
        titleKey: "sections.discuss",
        items: [
          {
            id: "activity_types",
            titleKey: "items.activityTypes",
            descKey: "items.activityTypesDesc",
            fields: [{ kind: "action", labelKey: "actions.activityTypes" }],
          },
          {
            id: "twilio_ice",
            titleKey: "items.twilioIce",
            descKey: "items.twilioIceDesc",
            fields: [
              { kind: "boolean", key: "twilio_ice" },
              { kind: "text", key: "twilio_account_sid", placeholderKey: "placeholders.twilioSid" },
              {
                kind: "text",
                key: "twilio_auth_token",
                placeholderKey: "placeholders.twilioToken",
                secret: true,
              },
            ],
          },
          {
            id: "custom_sfu",
            titleKey: "items.customSfu",
            descKey: "items.customSfuDesc",
            fields: [{ kind: "boolean", key: "custom_sfu" }],
          },
          {
            id: "custom_ice",
            titleKey: "items.customIce",
            descKey: "items.customIceDesc",
            fields: [{ kind: "action", labelKey: "actions.configureIce" }],
          },
          {
            id: "tenor_gif",
            titleKey: "items.tenorGif",
            descKey: "items.tenorGifDesc",
            fields: [
              { kind: "text", key: "tenor_api_key", placeholderKey: "placeholders.apiKey", secret: true },
            ],
          },
          {
            id: "message_translation",
            titleKey: "items.messageTranslation",
            descKey: "items.messageTranslationDesc",
            fields: [
              {
                kind: "text",
                key: "google_translate_key",
                placeholderKey: "placeholders.apiKey",
                secret: true,
              },
            ],
          },
        ],
      },
      {
        id: "contacts",
        titleKey: "sections.contacts",
        items: [
          {
            id: "send_sms",
            titleKey: "items.sendSms",
            descKey: "items.sendSmsDesc",
            fields: [{ kind: "action", labelKey: "actions.manageIapCredits" }],
          },
          {
            id: "partner_autocomplete",
            titleKey: "items.partnerAutocomplete",
            descKey: "items.partnerAutocompleteDesc",
            fields: [
              { kind: "boolean", key: "partner_autocomplete" },
              { kind: "action", labelKey: "actions.manageIapCredits" },
            ],
          },
          {
            id: "odoo_iap",
            titleKey: "items.odooIap",
            descKey: "items.odooIapDesc",
            fields: [{ kind: "action", labelKey: "actions.viewMyServices" }],
          },
        ],
      },
      {
        id: "permissions",
        titleKey: "sections.permissions",
        items: [
          {
            id: "password_reset",
            titleKey: "items.passwordReset",
            descKey: "items.passwordResetDesc",
            fields: [{ kind: "boolean", key: "password_reset" }],
          },
          {
            id: "default_access_rights",
            titleKey: "items.defaultAccessRights",
            descKey: "items.defaultAccessRightsDesc",
            fields: [{ kind: "action", labelKey: "actions.defaultAccessRights" }],
          },
          {
            id: "api_keys",
            titleKey: "items.apiKeys",
            descKey: "items.apiKeysDesc",
            fields: [{ kind: "action", labelKey: "actions.manageApiKeys" }],
          },
          {
            id: "enforce_2fa",
            titleKey: "items.enforce2fa",
            descKey: "items.enforce2faDesc",
            fields: [{ kind: "boolean", key: "enforce_2fa" }],
          },
        ],
      },
      {
        id: "certs",
        titleKey: "sections.certs",
        items: [
          {
            id: "certificates",
            titleKey: "items.certificates",
            descKey: "items.certificatesDesc",
            fields: [
              { kind: "action", labelKey: "actions.certificates" },
              { kind: "action", labelKey: "actions.keys" },
            ],
          },
        ],
      },
      {
        id: "integrations",
        titleKey: "sections.integrations",
        items: [
          {
            id: "mail_plugin",
            titleKey: "items.mailPlugin",
            descKey: "items.mailPluginDesc",
            fields: [{ kind: "boolean", key: "mail_plugin" }],
          },
          {
            id: "oauth",
            titleKey: "items.oauth",
            descKey: "items.oauthDesc",
            fields: [{ kind: "boolean", key: "oauth_auth" }],
          },
          {
            id: "ldap",
            titleKey: "items.ldap",
            descKey: "items.ldapDesc",
            fields: [{ kind: "boolean", key: "ldap_auth" }],
          },
          {
            id: "unsplash",
            titleKey: "items.unsplash",
            descKey: "items.unsplashDesc",
            fields: [{ kind: "boolean", key: "unsplash" }],
          },
          {
            id: "geolocation",
            titleKey: "items.geolocation",
            descKey: "items.geolocationDesc",
            fields: [{ kind: "boolean", key: "geolocation" }],
          },
          {
            id: "mapbox",
            titleKey: "items.mapbox",
            descKey: "items.mapboxDesc",
            fields: [
              { kind: "text", key: "mapbox_token", placeholderKey: "placeholders.token", secret: true },
            ],
          },
          {
            id: "recaptcha",
            titleKey: "items.recaptcha",
            descKey: "items.recaptchaDesc",
            fields: [
              { kind: "boolean", key: "recaptcha" },
              { kind: "text", key: "recaptcha_site_key", placeholderKey: "placeholders.siteKey" },
              {
                kind: "text",
                key: "recaptcha_secret_key",
                placeholderKey: "placeholders.secretKey",
                secret: true,
              },
              { kind: "number", key: "recaptcha_min_score", min: 0, max: 1, step: 0.05 },
            ],
          },
          {
            id: "turnstile",
            titleKey: "items.turnstile",
            descKey: "items.turnstileDesc",
            fields: [{ kind: "boolean", key: "cloudflare_turnstile" }],
          },
          {
            id: "google_places",
            titleKey: "items.googlePlaces",
            descKey: "items.googlePlacesDesc",
            fields: [{ kind: "boolean", key: "google_address_autocomplete" }],
          },
          {
            id: "own_chatgpt",
            titleKey: "items.ownChatgpt",
            descKey: "items.ownChatgptDesc",
            fields: [
              { kind: "boolean", key: "own_chatgpt" },
              {
                kind: "text",
                key: "openai_api_key",
                placeholderKey: "placeholders.apiKey",
                secret: true,
              },
            ],
          },
          {
            id: "own_gemini",
            titleKey: "items.ownGemini",
            descKey: "items.ownGeminiDesc",
            fields: [
              { kind: "boolean", key: "own_gemini" },
              {
                kind: "text",
                key: "gemini_api_key",
                placeholderKey: "placeholders.apiKey",
                secret: true,
              },
            ],
          },
          {
            id: "live_integrations",
            titleKey: "items.liveIntegrations",
            descKey: "items.liveIntegrationsDesc",
            fields: [{ kind: "action", labelKey: "actions.openSetup", href: "/setup" }],
          },
        ],
      },
      {
        id: "developer",
        titleKey: "sections.developer",
        items: [
          {
            id: "developer_mode",
            titleKey: "items.developerMode",
            descKey: "items.developerModeDesc",
            fields: [
              { kind: "boolean", key: "developer_mode" },
              { kind: "boolean", key: "developer_mode_assets" },
              { kind: "boolean", key: "developer_mode_assets_test" },
            ],
          },
        ],
      },
      {
        id: "about",
        titleKey: "sections.about",
        items: [
          {
            id: "about",
            titleKey: "items.about",
            descKey: "items.aboutDesc",
            fields: [{ kind: "info", labelKey: "info.aboutVersion" }],
          },
        ],
      },
    ],
  },
  {
    id: "crm",
    titleKey: "tabs.crm",
    icon: "crm",
    sections: [
      {
        id: "crm_main",
        titleKey: "sections.crm",
        items: [
          {
            id: "recurring_revenues",
            titleKey: "items.recurringRevenues",
            descKey: "items.recurringRevenuesDesc",
            fields: [{ kind: "boolean", key: "crm_recurring_revenues" }],
          },
          {
            id: "leads",
            titleKey: "items.leads",
            descKey: "items.leadsDesc",
            fields: [{ kind: "boolean", key: "crm_leads" }],
          },
          {
            id: "multi_teams",
            titleKey: "items.multiTeams",
            descKey: "items.multiTeamsDesc",
            fields: [{ kind: "boolean", key: "crm_multi_teams" }],
          },
          {
            id: "ringover",
            titleKey: "items.ringover",
            descKey: "items.ringoverDesc",
            fields: [{ kind: "action", labelKey: "actions.installExtension" }],
          },
          {
            id: "membership",
            titleKey: "items.membership",
            descKey: "items.membershipDesc",
            fields: [{ kind: "boolean", key: "crm_membership" }],
          },
          {
            id: "predictive_lead_scoring",
            titleKey: "items.predictiveLeadScoring",
            descKey: "items.predictiveLeadScoringDesc",
            fields: [
              { kind: "boolean", key: "crm_predictive_scoring" },
              { kind: "action", labelKey: "actions.updateProbabilities" },
            ],
          },
          {
            id: "rule_based_assignment",
            titleKey: "items.ruleBasedAssignment",
            descKey: "items.ruleBasedAssignmentDesc",
            fields: [{ kind: "boolean", key: "crm_rule_assignment" }],
          },
        ],
      },
      {
        id: "lead_generation",
        titleKey: "sections.leadGeneration",
        items: [
          {
            id: "lead_enrichment",
            titleKey: "items.leadEnrichment",
            descKey: "items.leadEnrichmentDesc",
            fields: [
              { kind: "boolean", key: "crm_lead_enrichment" },
              {
                kind: "radio",
                key: "crm_lead_enrichment_mode",
                options: [
                  { value: "on_demand", labelKey: "options.enrichOnDemand" },
                  { value: "auto", labelKey: "options.enrichAuto" },
                ],
              },
              { kind: "action", labelKey: "actions.manageIapCredits" },
              { kind: "action", labelKey: "actions.viewMyServices" },
            ],
          },
          {
            id: "lead_mining",
            titleKey: "items.leadMining",
            descKey: "items.leadMiningDesc",
            fields: [
              { kind: "boolean", key: "crm_lead_mining" },
              { kind: "action", labelKey: "actions.manageIapCredits" },
              { kind: "action", labelKey: "actions.viewMyServices" },
            ],
          },
          {
            id: "visitors_to_leads",
            titleKey: "items.visitorsToLeads",
            descKey: "items.visitorsToLeadsDesc",
            fields: [{ kind: "boolean", key: "crm_visitors_to_leads" }],
          },
        ],
      },
    ],
  },
  {
    id: "sales",
    titleKey: "tabs.sales",
    icon: "sales",
    sections: [
      {
        id: "product_catalog",
        titleKey: "sections.productCatalog",
        items: [
          {
            id: "variants",
            titleKey: "items.variants",
            descKey: "items.variantsDesc",
            fields: [
              { kind: "boolean", key: "sale_variants" },
              { kind: "action", labelKey: "actions.attributes", href: "/products" },
            ],
          },
          {
            id: "variant_grid",
            titleKey: "items.variantGrid",
            descKey: "items.variantGridDesc",
            fields: [{ kind: "boolean", key: "sale_variant_grid" }],
          },
          {
            id: "uom_packaging",
            titleKey: "items.uomPackaging",
            descKey: "items.uomPackagingDesc",
            fields: [{ kind: "boolean", key: "sale_uom_packaging" }],
          },
          {
            id: "send_content_email",
            titleKey: "items.sendContentEmail",
            descKey: "items.sendContentEmailDesc",
            fields: [{ kind: "boolean", key: "sale_send_content_email" }],
          },
        ],
      },
      {
        id: "pricing",
        titleKey: "sections.pricing",
        items: [
          {
            id: "discounts",
            titleKey: "items.discounts",
            descKey: "items.discountsDesc",
            fields: [{ kind: "boolean", key: "sale_discounts" }],
          },
          {
            id: "promotions",
            titleKey: "items.promotions",
            descKey: "items.promotionsDesc",
            fields: [{ kind: "boolean", key: "sale_promotions" }],
          },
          {
            id: "pricelists",
            titleKey: "items.pricelists",
            descKey: "items.pricelistsDesc",
            fields: [
              { kind: "boolean", key: "sale_pricelists" },
              { kind: "action", labelKey: "actions.pricelists" },
            ],
          },
          {
            id: "customer_account",
            titleKey: "items.customerAccount",
            descKey: "items.customerAccountDesc",
            fields: [
              { kind: "boolean", key: "sale_customer_account" },
              {
                kind: "radio",
                key: "sale_customer_account_mode",
                options: [
                  { value: "invite", labelKey: "options.onInvitation" },
                  { value: "free", labelKey: "options.freeSignup" },
                ],
              },
            ],
          },
          {
            id: "margins",
            titleKey: "items.margins",
            descKey: "items.marginsDesc",
            fields: [{ kind: "boolean", key: "sale_margins" }],
          },
        ],
      },
      {
        id: "quotes_orders",
        titleKey: "sections.quotesOrders",
        items: [
          {
            id: "online_signature",
            titleKey: "items.onlineSignature",
            descKey: "items.onlineSignatureDesc",
            fields: [{ kind: "boolean", key: "sale_online_signature" }],
          },
          {
            id: "quote_templates",
            titleKey: "items.quoteTemplates",
            descKey: "items.quoteTemplatesDesc",
            fields: [
              { kind: "boolean", key: "sale_quote_templates" },
              {
                kind: "action",
                labelKey: "actions.quoteTemplates",
                href: "/sales/quote-templates",
              },
            ],
          },
          {
            id: "online_payment",
            titleKey: "items.onlinePayment",
            descKey: "items.onlinePaymentDesc",
            fields: [
              { kind: "boolean", key: "sale_online_payment" },
              { kind: "number", key: "sale_online_payment_percent", min: 0, max: 100, suffixKey: "suffix.percent" },
              { kind: "action", labelKey: "actions.configurePayment" },
            ],
          },
          {
            id: "quote_validity",
            titleKey: "items.quoteValidity",
            descKey: "items.quoteValidityDesc",
            fields: [
              { kind: "number", key: "sale_quote_validity_days", min: 0, suffixKey: "suffix.days" },
            ],
          },
          {
            id: "sale_warnings",
            titleKey: "items.saleWarnings",
            descKey: "items.saleWarningsDesc",
            fields: [{ kind: "boolean", key: "sale_warnings" }],
          },
          {
            id: "pdf_quote_builder",
            titleKey: "items.pdfQuoteBuilder",
            descKey: "items.pdfQuoteBuilderDesc",
            fields: [
              { kind: "boolean", key: "sale_pdf_quote_builder" },
              { kind: "action", labelKey: "actions.headersFooters" },
            ],
          },
          {
            id: "lock_confirmed",
            titleKey: "items.lockConfirmedSales",
            descKey: "items.lockConfirmedSalesDesc",
            fields: [{ kind: "boolean", key: "sale_lock_confirmed" }],
          },
          {
            id: "proforma",
            titleKey: "items.proforma",
            descKey: "items.proformaDesc",
            fields: [{ kind: "boolean", key: "sale_proforma" }],
          },
        ],
      },
      {
        id: "shipping",
        titleKey: "sections.shipping",
        items: [
          {
            id: "delivery_methods",
            titleKey: "items.deliveryMethods",
            descKey: "items.deliveryMethodsDesc",
            fields: [{ kind: "boolean", key: "sale_delivery_methods" }],
          },
          {
            id: "ups",
            titleKey: "items.connectorUps",
            descKey: "items.connectorInstallDesc",
            fields: [{ kind: "boolean", key: "sale_ups" }],
          },
          {
            id: "dhl",
            titleKey: "items.connectorDhl",
            descKey: "items.connectorInstallDesc",
            fields: [{ kind: "boolean", key: "sale_dhl" }],
          },
          {
            id: "fedex",
            titleKey: "items.connectorFedex",
            descKey: "items.connectorInstallDesc",
            fields: [{ kind: "boolean", key: "sale_fedex" }],
          },
          {
            id: "usps",
            titleKey: "items.connectorUsps",
            descKey: "items.connectorInstallDesc",
            fields: [{ kind: "boolean", key: "sale_usps" }],
          },
          {
            id: "bpost",
            titleKey: "items.connectorBpost",
            descKey: "items.connectorBpostDesc",
            fields: [{ kind: "boolean", key: "sale_bpost" }],
          },
          {
            id: "easypost",
            titleKey: "items.connectorEasypost",
            descKey: "items.connectorEasypostDesc",
            fields: [{ kind: "boolean", key: "sale_easypost" }],
          },
          {
            id: "sendcloud",
            titleKey: "items.connectorSendcloud",
            descKey: "items.connectorSendcloudDesc",
            fields: [{ kind: "boolean", key: "sale_sendcloud" }],
          },
          {
            id: "shiprocket",
            titleKey: "items.connectorShiprocket",
            descKey: "items.connectorShiprocketDesc",
            fields: [{ kind: "boolean", key: "sale_shiprocket" }],
          },
          {
            id: "starshipit",
            titleKey: "items.connectorStarshipit",
            descKey: "items.connectorStarshipitDesc",
            fields: [{ kind: "boolean", key: "sale_starshipit" }],
          },
          {
            id: "envia",
            titleKey: "items.connectorEnvia",
            descKey: "items.connectorEnviaDesc",
            fields: [{ kind: "boolean", key: "sale_envia" }],
          },
        ],
      },
      {
        id: "invoicing",
        titleKey: "sections.invoicing",
        items: [
          {
            id: "invoicing_policy",
            titleKey: "items.invoicingPolicy",
            descKey: "items.invoicingPolicyDesc",
            fields: [
              {
                kind: "radio",
                key: "sale_invoicing_policy",
                options: [
                  { value: "ordered", labelKey: "options.invoiceOrdered" },
                  { value: "delivered", labelKey: "options.invoiceDelivered" },
                ],
              },
            ],
          },
          {
            id: "automatic_invoice",
            titleKey: "items.automaticInvoice",
            descKey: "items.automaticInvoiceDesc",
            fields: [{ kind: "boolean", key: "sale_automatic_invoice" }],
          },
          {
            id: "commissions",
            titleKey: "items.commissions",
            descKey: "items.commissionsDesc",
            fields: [{ kind: "boolean", key: "sale_commissions" }],
          },
        ],
      },
      {
        id: "connectors",
        titleKey: "sections.connectors",
        items: [
          {
            id: "amazon",
            titleKey: "items.amazonSync",
            descKey: "items.amazonSyncDesc",
            fields: [{ kind: "boolean", key: "sale_amazon" }],
          },
          {
            id: "gelato",
            titleKey: "items.gelato",
            descKey: "items.gelatoDesc",
            fields: [{ kind: "boolean", key: "sale_gelato" }],
          },
          {
            id: "shopee",
            titleKey: "items.shopeeSync",
            descKey: "items.shopeeSyncDesc",
            fields: [{ kind: "boolean", key: "sale_shopee" }],
          },
        ],
      },
    ],
  },
  {
    id: "calendar",
    titleKey: "tabs.calendar",
    icon: "calendar",
    sections: [
      {
        id: "calendar_settings",
        titleKey: "sections.calendar",
        items: [
          {
            id: "outlook",
            titleKey: "items.outlookCalendar",
            descKey: "items.outlookCalendarDesc",
            fields: [{ kind: "boolean", key: "calendar_outlook" }],
          },
          {
            id: "google",
            titleKey: "items.googleCalendar",
            descKey: "items.googleCalendarDesc",
            fields: [{ kind: "boolean", key: "calendar_google" }],
          },
        ],
      },
    ],
  },
  {
    id: "website",
    titleKey: "tabs.website",
    icon: "website",
    sections: [
      {
        id: "website_general",
        titleKey: "sections.websiteGeneral",
        items: [
          {
            id: "domain",
            titleKey: "items.websiteDomain",
            descKey: "items.websiteDomainDesc",
            fields: [
              { kind: "text", key: "website_domain", placeholderKey: "placeholders.domain" },
            ],
          },
          {
            id: "website_languages",
            titleKey: "items.websiteLanguages",
            descKey: "items.websiteLanguagesDesc",
            fields: [
              { kind: "info", labelKey: "info.websiteLanguages" },
              { kind: "action", labelKey: "actions.installLanguages" },
            ],
          },
          {
            id: "website_identity",
            titleKey: "items.websiteIdentity",
            descKey: "items.websiteIdentityDesc",
            fields: [
              { kind: "text", key: "website_name", placeholderKey: "placeholders.websiteName" },
            ],
          },
          {
            id: "website_customer_account",
            titleKey: "items.customerAccount",
            descKey: "items.customerAccountDesc",
            fields: [
              { kind: "boolean", key: "website_customer_account" },
              {
                kind: "radio",
                key: "website_customer_account_mode",
                options: [
                  { value: "invite", labelKey: "options.onInvitation" },
                  { value: "free", labelKey: "options.freeSignup" },
                ],
              },
            ],
          },
          {
            id: "livechat",
            titleKey: "items.liveChat",
            descKey: "items.liveChatDesc",
            fields: [{ kind: "boolean", key: "website_livechat" }],
          },
          {
            id: "push",
            titleKey: "items.pushNotifications",
            descKey: "items.pushNotificationsDesc",
            fields: [{ kind: "boolean", key: "website_push" }],
          },
        ],
      },
      {
        id: "website_payments",
        titleKey: "sections.websitePayments",
        items: [
          {
            id: "payment_providers",
            titleKey: "items.paymentProviders",
            descKey: "items.paymentProvidersDesc",
            fields: [{ kind: "action", labelKey: "actions.configurePayment" }],
          },
        ],
      },
      {
        id: "website_seo",
        titleKey: "sections.websiteSeo",
        items: [
          {
            id: "plausible",
            titleKey: "items.plausible",
            descKey: "items.plausibleDesc",
            fields: [
              { kind: "boolean", key: "website_plausible" },
              { kind: "text", key: "plausible_shared_auth" },
              { kind: "text", key: "plausible_site" },
            ],
          },
          {
            id: "ga",
            titleKey: "items.googleAnalytics",
            descKey: "items.googleAnalyticsDesc",
            fields: [
              { kind: "boolean", key: "website_ga" },
              { kind: "text", key: "ga_key", placeholderKey: "placeholders.gaKey" },
            ],
          },
          {
            id: "gsc",
            titleKey: "items.googleSearchConsole",
            descKey: "items.googleSearchConsoleDesc",
            fields: [
              { kind: "boolean", key: "website_gsc" },
              { kind: "action", labelKey: "actions.openSearchConsole", href: "/search-console" },
            ],
          },
          {
            id: "cookie_bar",
            titleKey: "items.cookieBar",
            descKey: "items.cookieBarDesc",
            fields: [{ kind: "boolean", key: "website_cookie_bar" }],
          },
        ],
      },
    ],
  },
  {
    id: "purchase",
    titleKey: "tabs.purchase",
    icon: "purchase",
    sections: [
      {
        id: "purchase_orders",
        titleKey: "sections.purchaseOrders",
        items: [
          {
            id: "po_approval",
            titleKey: "items.poApproval",
            descKey: "items.poApprovalDesc",
            fields: [
              { kind: "boolean", key: "purchase_approval" },
              { kind: "number", key: "purchase_approval_amount", min: 0 },
            ],
          },
          {
            id: "lock_po",
            titleKey: "items.lockConfirmedPo",
            descKey: "items.lockConfirmedPoDesc",
            fields: [{ kind: "boolean", key: "purchase_lock_confirmed" }],
          },
          {
            id: "purchase_warnings",
            titleKey: "items.purchaseWarnings",
            descKey: "items.purchaseWarningsDesc",
            fields: [{ kind: "boolean", key: "purchase_warnings" }],
          },
          {
            id: "purchase_agreements",
            titleKey: "items.purchaseAgreements",
            descKey: "items.purchaseAgreementsDesc",
            fields: [{ kind: "boolean", key: "purchase_agreements" }],
          },
          {
            id: "receipt_reminder",
            titleKey: "items.receiptReminder",
            descKey: "items.receiptReminderDesc",
            fields: [{ kind: "boolean", key: "purchase_receipt_reminder" }],
          },
        ],
      },
      {
        id: "purchase_invoicing",
        titleKey: "sections.purchaseInvoicing",
        items: [
          {
            id: "three_way",
            titleKey: "items.threeWayMatching",
            descKey: "items.threeWayMatchingDesc",
            fields: [{ kind: "boolean", key: "purchase_three_way" }],
          },
        ],
      },
      {
        id: "purchase_products",
        titleKey: "sections.purchaseProducts",
        items: [
          {
            id: "purchase_variants",
            titleKey: "items.variants",
            descKey: "items.purchaseVariantsDesc",
            fields: [{ kind: "boolean", key: "purchase_variants" }],
          },
          {
            id: "purchase_variant_grid",
            titleKey: "items.variantGrid",
            descKey: "items.variantGridDesc",
            fields: [{ kind: "boolean", key: "purchase_variant_grid" }],
          },
          {
            id: "purchase_uom",
            titleKey: "items.uomPackaging",
            descKey: "items.uomPackagingDesc",
            fields: [{ kind: "boolean", key: "purchase_uom_packaging" }],
          },
        ],
      },
      {
        id: "purchase_logistics",
        titleKey: "sections.purchaseLogistics",
        items: [
          {
            id: "dropshipping",
            titleKey: "items.dropshipping",
            descKey: "items.dropshippingDesc",
            fields: [{ kind: "boolean", key: "purchase_dropshipping" }],
          },
          {
            id: "mto",
            titleKey: "items.mto",
            descKey: "items.mtoDesc",
            fields: [{ kind: "boolean", key: "purchase_mto" }],
          },
        ],
      },
    ],
  },
  {
    id: "inventory",
    titleKey: "tabs.inventory",
    icon: "inventory",
    sections: [
      {
        id: "operations",
        titleKey: "sections.operations",
        items: [
          {
            id: "packages",
            titleKey: "items.packages",
            descKey: "items.packagesDesc",
            fields: [{ kind: "boolean", key: "inv_packages" }],
          },
          {
            id: "batch_transfers",
            titleKey: "items.batchTransfers",
            descKey: "items.batchTransfersDesc",
            fields: [{ kind: "boolean", key: "inv_batch_transfers" }],
          },
          {
            id: "partner_instructions",
            titleKey: "items.partnerInstructions",
            descKey: "items.partnerInstructionsDesc",
            fields: [{ kind: "boolean", key: "inv_partner_instructions" }],
          },
          {
            id: "quality",
            titleKey: "items.quality",
            descKey: "items.qualityDesc",
            fields: [{ kind: "boolean", key: "inv_quality" }],
          },
          {
            id: "annual_inventory",
            titleKey: "items.annualInventory",
            descKey: "items.annualInventoryDesc",
            fields: [
              { kind: "number", key: "inv_annual_day", min: 1, max: 31 },
              { kind: "number", key: "inv_annual_month", min: 1, max: 12 },
            ],
          },
          {
            id: "reception_report",
            titleKey: "items.receptionReport",
            descKey: "items.receptionReportDesc",
            fields: [{ kind: "boolean", key: "inv_reception_report" }],
          },
        ],
      },
      {
        id: "barcode",
        titleKey: "sections.barcode",
        items: [
          {
            id: "barcode_scanner",
            titleKey: "items.barcodeScanner",
            descKey: "items.barcodeScannerDesc",
            fields: [{ kind: "boolean", key: "inv_barcode" }],
          },
          {
            id: "barcode_db",
            titleKey: "items.barcodeDb",
            descKey: "items.barcodeDbDesc",
            fields: [{ kind: "boolean", key: "inv_barcode_db" }],
          },
        ],
      },
      {
        id: "inv_shipping",
        titleKey: "sections.shipping",
        items: [
          {
            id: "inv_delivery",
            titleKey: "items.deliveryMethods",
            descKey: "items.deliveryMethodsShortDesc",
            fields: [{ kind: "boolean", key: "inv_delivery_methods" }],
          },
          {
            id: "shipping_management",
            titleKey: "items.shippingManagement",
            descKey: "items.shippingManagementDesc",
            fields: [{ kind: "boolean", key: "inv_shipping_management" }],
          },
          {
            id: "delivery_email",
            titleKey: "items.deliveryEmailConfirm",
            descKey: "items.deliveryEmailConfirmDesc",
            fields: [{ kind: "boolean", key: "inv_delivery_email" }],
          },
          {
            id: "delivery_sms",
            titleKey: "items.deliverySmsConfirm",
            descKey: "items.deliverySmsConfirmDesc",
            fields: [
              { kind: "boolean", key: "inv_delivery_sms" },
              { kind: "action", labelKey: "actions.manageIapCredits" },
            ],
          },
          {
            id: "delivery_signature",
            titleKey: "items.deliverySignature",
            descKey: "items.deliverySignatureDesc",
            fields: [{ kind: "boolean", key: "inv_delivery_signature" }],
          },
        ],
      },
      {
        id: "inv_shipping_connectors",
        titleKey: "sections.shippingConnectors",
        items: [
          { id: "inv_ups", titleKey: "items.connectorUps", descKey: "items.connectorInstallDesc", fields: [{ kind: "boolean", key: "inv_ups" }] },
          { id: "inv_dhl", titleKey: "items.connectorDhl", descKey: "items.connectorInstallDesc", fields: [{ kind: "boolean", key: "inv_dhl" }] },
          { id: "inv_fedex", titleKey: "items.connectorFedex", descKey: "items.connectorInstallDesc", fields: [{ kind: "boolean", key: "inv_fedex" }] },
          { id: "inv_usps", titleKey: "items.connectorUsps", descKey: "items.connectorInstallDesc", fields: [{ kind: "boolean", key: "inv_usps" }] },
          { id: "inv_bpost", titleKey: "items.connectorBpost", descKey: "items.connectorBpostDesc", fields: [{ kind: "boolean", key: "inv_bpost" }] },
          { id: "inv_easypost", titleKey: "items.connectorEasypost", descKey: "items.connectorEasypostDesc", fields: [{ kind: "boolean", key: "inv_easypost" }] },
          { id: "inv_sendcloud", titleKey: "items.connectorSendcloud", descKey: "items.connectorSendcloudDesc", fields: [{ kind: "boolean", key: "inv_sendcloud" }] },
          { id: "inv_shiprocket", titleKey: "items.connectorShiprocket", descKey: "items.connectorShiprocketDesc", fields: [{ kind: "boolean", key: "inv_shiprocket" }] },
          { id: "inv_starshipit", titleKey: "items.connectorStarshipit", descKey: "items.connectorStarshipitDesc", fields: [{ kind: "boolean", key: "inv_starshipit" }] },
          { id: "inv_envia", titleKey: "items.connectorEnvia", descKey: "items.connectorEnviaDesc", fields: [{ kind: "boolean", key: "inv_envia" }] },
        ],
      },
      {
        id: "inv_products",
        titleKey: "sections.products",
        items: [
          {
            id: "inv_variants",
            titleKey: "items.variants",
            descKey: "items.invVariantsDesc",
            fields: [{ kind: "boolean", key: "inv_variants" }],
          },
          {
            id: "inv_uom",
            titleKey: "items.uomPackaging",
            descKey: "items.uomPackagingDesc",
            fields: [{ kind: "boolean", key: "inv_uom_packaging" }],
          },
        ],
      },
      {
        id: "traceability",
        titleKey: "sections.traceability",
        items: [
          {
            id: "lots",
            titleKey: "items.lotsSerial",
            descKey: "items.lotsSerialDesc",
            fields: [{ kind: "boolean", key: "inv_lots" }],
          },
          {
            id: "gs1",
            titleKey: "items.gs1Barcodes",
            descKey: "items.gs1BarcodesDesc",
            fields: [{ kind: "boolean", key: "inv_gs1" }],
          },
          {
            id: "expiration",
            titleKey: "items.expirationDates",
            descKey: "items.expirationDatesDesc",
            fields: [{ kind: "boolean", key: "inv_expiration" }],
          },
          {
            id: "lots_on_delivery",
            titleKey: "items.lotsOnDelivery",
            descKey: "items.lotsOnDeliveryDesc",
            fields: [{ kind: "boolean", key: "inv_lots_on_delivery" }],
          },
          {
            id: "consignment",
            titleKey: "items.consignment",
            descKey: "items.consignmentDesc",
            fields: [{ kind: "boolean", key: "inv_consignment" }],
          },
        ],
      },
      {
        id: "valuation",
        titleKey: "sections.valuation",
        items: [
          {
            id: "landed_costs",
            titleKey: "items.landedCosts",
            descKey: "items.landedCostsDesc",
            fields: [{ kind: "boolean", key: "inv_landed_costs" }],
          },
          {
            id: "lots_on_invoices",
            titleKey: "items.lotsOnInvoices",
            descKey: "items.lotsOnInvoicesDesc",
            fields: [{ kind: "boolean", key: "inv_lots_on_invoices" }],
          },
        ],
      },
      {
        id: "warehouse",
        titleKey: "sections.warehouse",
        items: [
          {
            id: "storage_locations",
            titleKey: "items.storageLocations",
            descKey: "items.storageLocationsDesc",
            fields: [{ kind: "boolean", key: "inv_storage_locations" }],
          },
          {
            id: "multi_step_routes",
            titleKey: "items.multiStepRoutes",
            descKey: "items.multiStepRoutesDesc",
            fields: [{ kind: "boolean", key: "inv_multi_step_routes" }],
          },
        ],
      },
      {
        id: "advanced_planning",
        titleKey: "sections.advancedPlanning",
        items: [
          {
            id: "replenishment_horizon",
            titleKey: "items.replenishmentHorizon",
            descKey: "items.replenishmentHorizonDesc",
            fields: [{ kind: "number", key: "inv_replenishment_days", min: 0, suffixKey: "suffix.days" }],
          },
          {
            id: "sales_safety",
            titleKey: "items.salesSafetyDays",
            descKey: "items.salesSafetyDaysDesc",
            fields: [{ kind: "number", key: "inv_sales_safety_days", min: 0, suffixKey: "suffix.days" }],
          },
          {
            id: "purchase_days",
            titleKey: "items.daysToPurchase",
            descKey: "items.daysToPurchaseDesc",
            fields: [{ kind: "number", key: "inv_days_to_purchase", min: 0, suffixKey: "suffix.days" }],
          },
        ],
      },
      {
        id: "inv_logistics",
        titleKey: "sections.logistics",
        items: [
          {
            id: "inv_dropshipping",
            titleKey: "items.dropshipping",
            descKey: "items.dropshippingDesc",
            fields: [{ kind: "boolean", key: "inv_dropshipping" }],
          },
          {
            id: "inv_mto",
            titleKey: "items.mto",
            descKey: "items.mtoDesc",
            fields: [{ kind: "boolean", key: "inv_mto" }],
          },
        ],
      },
    ],
  },
  {
    id: "accounting",
    titleKey: "tabs.accounting",
    icon: "accounting",
    sections: [
      {
        id: "fiscal_localization",
        titleKey: "sections.fiscalLocalization",
        items: [
          {
            id: "fiscal_pack",
            titleKey: "items.fiscalLocalization",
            descKey: "items.fiscalLocalizationDesc",
            fields: [
              { kind: "info", labelKey: "info.fiscalPackPe" },
              { kind: "action", labelKey: "actions.reload" },
            ],
          },
        ],
      },
      {
        id: "accounting_import",
        titleKey: "sections.accountingImport",
        items: [
          {
            id: "initial_setup",
            titleKey: "items.accountingInitialSetup",
            descKey: "items.accountingInitialSetupDesc",
            fields: [
              {
                kind: "radio",
                key: "accounting_setup_mode",
                options: [
                  { value: "review", labelKey: "options.reviewManually" },
                  { value: "import", labelKey: "options.importHistory" },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "taxes",
        titleKey: "sections.taxes",
        items: [
          {
            id: "default_taxes",
            titleKey: "items.defaultTaxes",
            descKey: "items.defaultTaxesDesc",
            fields: [
              { kind: "text", key: "tax_sale_default" },
              { kind: "text", key: "tax_purchase_default" },
            ],
          },
          {
            id: "price_tax",
            titleKey: "items.priceIncludesTax",
            descKey: "items.priceIncludesTaxDesc",
            fields: [
              {
                kind: "radio",
                key: "tax_included",
                options: [
                  { value: "excluded", labelKey: "options.taxExcluded" },
                  { value: "included", labelKey: "options.taxIncluded" },
                ],
              },
            ],
          },
          {
            id: "tax_periodicity",
            titleKey: "items.taxPeriodicity",
            descKey: "items.taxPeriodicityDesc",
            fields: [
              {
                kind: "select",
                key: "tax_periodicity",
                options: [
                  { value: "monthly", labelKey: "options.monthly" },
                  { value: "quarterly", labelKey: "options.quarterly" },
                  { value: "yearly", labelKey: "options.yearly" },
                ],
              },
              { kind: "number", key: "tax_deadline_days", min: 0, suffixKey: "suffix.daysAfterPeriod" },
            ],
          },
          {
            id: "rounding_method",
            titleKey: "items.roundingMethod",
            descKey: "items.roundingMethodDesc",
            fields: [
              {
                kind: "radio",
                key: "tax_rounding",
                options: [
                  { value: "per_tax", labelKey: "options.roundPerTax" },
                  { value: "per_line", labelKey: "options.roundPerLine" },
                ],
              },
            ],
          },
          {
            id: "vies",
            titleKey: "items.viesCheck",
            descKey: "items.viesCheckDesc",
            fields: [{ kind: "boolean", key: "accounting_vies" }],
          },
          {
            id: "cash_basis",
            titleKey: "items.cashBasis",
            descKey: "items.cashBasisDesc",
            fields: [{ kind: "boolean", key: "accounting_cash_basis" }],
          },
          {
            id: "tax_country",
            titleKey: "items.taxCountry",
            descKey: "items.taxCountryDesc",
            fields: [{ kind: "text", key: "tax_country" }],
          },
        ],
      },
      {
        id: "currencies",
        titleKey: "sections.currencies",
        items: [
          {
            id: "main_currency",
            titleKey: "items.mainCurrency",
            descKey: "items.mainCurrencyDesc",
            fields: [
              {
                kind: "select",
                key: "main_currency",
                options: [
                  { value: "PEN", labelKey: "options.currencyPen" },
                  { value: "EUR", labelKey: "options.currencyEur" },
                  { value: "USD", labelKey: "options.currencyUsd" },
                ],
              },
              { kind: "action", labelKey: "actions.currencies" },
            ],
          },
          {
            id: "auto_rates",
            titleKey: "items.autoExchangeRates",
            descKey: "items.autoExchangeRatesDesc",
            fields: [
              { kind: "boolean", key: "auto_exchange_rates" },
              {
                kind: "select",
                key: "exchange_interval",
                options: [
                  { value: "daily", labelKey: "options.daily" },
                  { value: "weekly", labelKey: "options.weekly" },
                  { value: "monthly", labelKey: "options.monthly" },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "customer_invoices",
        titleKey: "sections.customerInvoices",
        items: [
          {
            id: "snailmail",
            titleKey: "items.snailmail",
            descKey: "items.snailmailDesc",
            fields: [
              { kind: "boolean", key: "accounting_snailmail" },
              { kind: "boolean", key: "snailmail_color" },
              { kind: "boolean", key: "snailmail_duplex" },
              { kind: "boolean", key: "snailmail_cover" },
              { kind: "action", labelKey: "actions.manageIapCredits" },
            ],
          },
          {
            id: "customer_addresses",
            titleKey: "items.customerAddresses",
            descKey: "items.customerAddressesDesc",
            fields: [{ kind: "boolean", key: "accounting_customer_addresses" }],
          },
          {
            id: "cash_rounding",
            titleKey: "items.cashRounding",
            descKey: "items.cashRoundingDesc",
            fields: [{ kind: "boolean", key: "accounting_cash_rounding" }],
          },
          {
            id: "default_incoterm",
            titleKey: "items.defaultIncoterm",
            descKey: "items.defaultIncotermDesc",
            fields: [{ kind: "text", key: "default_incoterm" }],
          },
          {
            id: "sale_receipt",
            titleKey: "items.saleReceipt",
            descKey: "items.saleReceiptDesc",
            fields: [{ kind: "boolean", key: "accounting_sale_receipt" }],
          },
          {
            id: "default_terms",
            titleKey: "items.defaultTerms",
            descKey: "items.defaultTermsDesc",
            fields: [{ kind: "text", key: "default_terms" }],
          },
          {
            id: "credit_limit",
            titleKey: "items.creditLimit",
            descKey: "items.creditLimitDesc",
            fields: [{ kind: "number", key: "credit_limit", min: 0 }],
          },
          {
            id: "amount_in_words",
            titleKey: "items.amountInWords",
            descKey: "items.amountInWordsDesc",
            fields: [{ kind: "boolean", key: "accounting_amount_in_words" }],
          },
          {
            id: "taxes_company_currency",
            titleKey: "items.taxesCompanyCurrency",
            descKey: "items.taxesCompanyCurrencyDesc",
            fields: [{ kind: "boolean", key: "accounting_taxes_company_currency" }],
          },
          {
            id: "invoice_authorized_signatory",
            titleKey: "items.invoiceSignatory",
            descKey: "items.invoiceSignatoryDesc",
            fields: [{ kind: "boolean", key: "accounting_invoice_signatory" }],
          },
        ],
      },
      {
        id: "pe_einvoicing",
        titleKey: "sections.peEinvoicing",
        items: [
          {
            id: "signature_provider",
            titleKey: "items.signatureProvider",
            descKey: "items.signatureProviderDesc",
            fields: [
              {
                kind: "radio",
                key: "pe_signature_provider",
                options: [
                  { value: "estela", labelKey: "options.estela" },
                  { value: "sunat", labelKey: "options.sunat" },
                  { value: "iap", labelKey: "options.iap" },
                ],
              },
            ],
          },
          {
            id: "pe_testing",
            titleKey: "items.peTestingEnv",
            descKey: "items.peTestingEnvDesc",
            fields: [{ kind: "boolean", key: "pe_testing_env" }],
          },
          {
            id: "ple_reports",
            titleKey: "items.pleReports",
            descKey: "items.pleReportsDesc",
            fields: [{ kind: "text", key: "ple_coa_type" }],
          },
        ],
      },
      {
        id: "customer_payments",
        titleKey: "sections.customerPayments",
        items: [
          {
            id: "online_invoice_payment",
            titleKey: "items.onlineInvoicePayment",
            descKey: "items.onlineInvoicePaymentDesc",
            fields: [
              { kind: "boolean", key: "accounting_online_invoice_payment" },
              { kind: "boolean", key: "accounting_qr_on_pdf" },
            ],
          },
          {
            id: "batch_payments",
            titleKey: "items.batchPayments",
            descKey: "items.batchPaymentsDesc",
            fields: [{ kind: "boolean", key: "accounting_batch_payments" }],
          },
          {
            id: "qr_codes",
            titleKey: "items.qrCodes",
            descKey: "items.qrCodesDesc",
            fields: [{ kind: "boolean", key: "accounting_qr_codes" }],
          },
        ],
      },
      {
        id: "vendor_bills",
        titleKey: "sections.vendorBills",
        items: [
          {
            id: "auto_validate_bills",
            titleKey: "items.autoValidateBills",
            descKey: "items.autoValidateBillsDesc",
            fields: [{ kind: "boolean", key: "accounting_auto_validate_bills" }],
          },
          {
            id: "predict_bill_product",
            titleKey: "items.predictBillProduct",
            descKey: "items.predictBillProductDesc",
            fields: [{ kind: "boolean", key: "accounting_predict_bill_product" }],
          },
        ],
      },
      {
        id: "vendor_payments",
        titleKey: "sections.vendorPayments",
        items: [
          {
            id: "checks",
            titleKey: "items.checks",
            descKey: "items.checksDesc",
            fields: [{ kind: "boolean", key: "accounting_checks" }],
          },
          {
            id: "sepa",
            titleKey: "items.sepa",
            descKey: "items.sepaDesc",
            fields: [{ kind: "boolean", key: "accounting_sepa" }],
          },
        ],
      },
      {
        id: "digitization",
        titleKey: "sections.digitization",
        items: [
          {
            id: "document_digitization",
            titleKey: "items.documentDigitization",
            descKey: "items.documentDigitizationDesc",
            fields: [
              { kind: "boolean", key: "accounting_digitization" },
              {
                kind: "radio",
                key: "accounting_bank_digitize",
                options: [
                  { value: "no", labelKey: "options.doNotDigitize" },
                  { value: "auto", labelKey: "options.digitizeAuto" },
                ],
              },
              {
                kind: "radio",
                key: "accounting_vendor_digitize",
                options: [
                  { value: "no", labelKey: "options.doNotDigitize" },
                  { value: "on_demand", labelKey: "options.digitizeOnDemand" },
                  { value: "auto", labelKey: "options.digitizeAuto" },
                ],
              },
              {
                kind: "radio",
                key: "accounting_customer_digitize",
                options: [
                  { value: "no", labelKey: "options.doNotDigitize" },
                  { value: "on_demand", labelKey: "options.digitizeOnDemand" },
                  { value: "auto", labelKey: "options.digitizeAuto" },
                ],
              },
              { kind: "action", labelKey: "actions.manageIapCredits" },
            ],
          },
        ],
      },
      {
        id: "default_accounts",
        titleKey: "sections.defaultAccounts",
        items: [
          {
            id: "default_accounts",
            titleKey: "items.defaultAccounts",
            descKey: "items.defaultAccountsDesc",
            fields: [{ kind: "action", labelKey: "actions.configureAccounts" }],
          },
        ],
      },
      {
        id: "inventory_valuation",
        titleKey: "sections.inventoryValuation",
        items: [
          {
            id: "inv_valuation",
            titleKey: "items.inventoryValuation",
            descKey: "items.inventoryValuationDesc",
            fields: [{ kind: "boolean", key: "accounting_inventory_valuation" }],
          },
        ],
      },
      {
        id: "bank_cash",
        titleKey: "sections.bankCash",
        items: [
          {
            id: "bank_sync",
            titleKey: "items.bankSync",
            descKey: "items.bankSyncDesc",
            fields: [{ kind: "boolean", key: "accounting_bank_sync" }],
          },
        ],
      },
      {
        id: "fiscal_periods",
        titleKey: "sections.fiscalPeriods",
        items: [
          {
            id: "fiscal_years",
            titleKey: "items.fiscalYears",
            descKey: "items.fiscalYearsDesc",
            fields: [{ kind: "boolean", key: "accounting_fiscal_years" }],
          },
        ],
      },
      {
        id: "analytic",
        titleKey: "sections.analytic",
        items: [
          {
            id: "analytic_accounting",
            titleKey: "items.analyticAccounting",
            descKey: "items.analyticAccountingDesc",
            fields: [{ kind: "boolean", key: "accounting_analytic" }],
          },
        ],
      },
      {
        id: "reporting",
        titleKey: "sections.reporting",
        items: [
          {
            id: "budget_management",
            titleKey: "items.budgetManagement",
            descKey: "items.budgetManagementDesc",
            fields: [{ kind: "boolean", key: "accounting_budget" }],
          },
        ],
      },
      {
        id: "storno",
        titleKey: "sections.storno",
        items: [
          {
            id: "storno_accounting",
            titleKey: "items.stornoAccounting",
            descKey: "items.stornoAccountingDesc",
            fields: [{ kind: "boolean", key: "accounting_storno" }],
          },
        ],
      },
    ],
  },
  {
    id: "project",
    titleKey: "tabs.project",
    icon: "project",
    sections: [
      {
        id: "task_management",
        titleKey: "sections.taskManagement",
        items: [
          {
            id: "project_stages",
            titleKey: "items.projectStages",
            descKey: "items.projectStagesDesc",
            fields: [{ kind: "boolean", key: "project_stages" }],
          },
        ],
      },
      {
        id: "time_management",
        titleKey: "sections.timeManagement",
        items: [
          {
            id: "timesheets",
            titleKey: "items.timesheets",
            descKey: "items.timesheetsDesc",
            fields: [{ kind: "boolean", key: "project_timesheets" }],
          },
        ],
      },
    ],
  },
  {
    id: "sign",
    titleKey: "tabs.sign",
    icon: "sign",
    sections: [
      {
        id: "sign_settings",
        titleKey: "sections.sign",
        items: [
          {
            id: "sign_terms",
            titleKey: "items.signDefaultTerms",
            descKey: "items.signDefaultTermsDesc",
            fields: [{ kind: "text", key: "sign_default_terms" }],
          },
          {
            id: "itsme",
            titleKey: "items.itsme",
            descKey: "items.itsmeDesc",
            fields: [
              { kind: "boolean", key: "sign_itsme" },
              { kind: "action", labelKey: "actions.manageIapCredits" },
            ],
          },
          {
            id: "sign_template_access",
            titleKey: "items.signTemplateAccess",
            descKey: "items.signTemplateAccessDesc",
            fields: [{ kind: "boolean", key: "sign_template_access" }],
          },
          {
            id: "sign_sms_auth",
            titleKey: "items.signSmsAuth",
            descKey: "items.signSmsAuthDesc",
            fields: [
              { kind: "boolean", key: "sign_sms_auth" },
              { kind: "action", labelKey: "actions.manageIapCredits" },
            ],
          },
          {
            id: "aadhaar",
            titleKey: "items.aadhaar",
            descKey: "items.aadhaarDesc",
            fields: [
              { kind: "boolean", key: "sign_aadhaar" },
              { kind: "action", labelKey: "actions.manageIapCredits" },
            ],
          },
          {
            id: "crypto_sign",
            titleKey: "items.cryptoSign",
            descKey: "items.cryptoSignDesc",
            fields: [
              { kind: "boolean", key: "sign_crypto" },
              { kind: "action", labelKey: "actions.signCertificate" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "planning",
    titleKey: "tabs.planning",
    icon: "planning",
    sections: [
      {
        id: "planning_main",
        titleKey: "sections.planning",
        items: [
          {
            id: "employee_unavailability",
            titleKey: "items.employeeUnavailability",
            descKey: "items.employeeUnavailabilityDesc",
            fields: [
              { kind: "boolean", key: "planning_unavailability" },
              { kind: "boolean", key: "planning_swap_shifts" },
              { kind: "boolean", key: "planning_self_unassign" },
            ],
          },
          {
            id: "project_planning",
            titleKey: "items.projectPlanning",
            descKey: "items.projectPlanningDesc",
            fields: [{ kind: "boolean", key: "planning_project" }],
          },
        ],
      },
    ],
  },
  {
    id: "email_marketing",
    titleKey: "tabs.emailMarketing",
    icon: "email",
    sections: [
      {
        id: "email_marketing_main",
        titleKey: "sections.emailMarketing",
        items: [
          {
            id: "email_campaigns",
            titleKey: "items.emailCampaigns",
            descKey: "items.emailCampaignsDesc",
            fields: [
              { kind: "boolean", key: "em_campaigns" },
              { kind: "action", labelKey: "actions.openEmailMarketing", href: "/email-marketing" },
            ],
          },
          {
            id: "split_name",
            titleKey: "items.splitName",
            descKey: "items.splitNameDesc",
            fields: [{ kind: "boolean", key: "em_split_name" }],
          },
          {
            id: "blacklist_optout",
            titleKey: "items.blacklistOptout",
            descKey: "items.blacklistOptoutDesc",
            fields: [{ kind: "boolean", key: "em_blacklist_optout" }],
          },
          {
            id: "mailing_stats_24h",
            titleKey: "items.mailingStats24h",
            descKey: "items.mailingStats24hDesc",
            fields: [{ kind: "boolean", key: "em_stats_24h" }],
          },
          {
            id: "dedicated_server",
            titleKey: "items.dedicatedServer",
            descKey: "items.dedicatedServerDesc",
            fields: [
              { kind: "boolean", key: "em_dedicated_server" },
              { kind: "action", labelKey: "actions.openSetup", href: "/setup" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "employees",
    titleKey: "tabs.employees",
    icon: "employees",
    sections: [
      {
        id: "employees_main",
        titleKey: "sections.employees",
        items: [
          {
            id: "presence_display",
            titleKey: "items.presenceDisplay",
            descKey: "items.presenceDisplayDesc",
            fields: [
              {
                kind: "radio",
                key: "hr_presence_display",
                options: [
                  { value: "attendance", labelKey: "options.basedOnAttendances" },
                  { value: "user_status", labelKey: "options.basedOnUserStatus" },
                ],
              },
            ],
          },
          {
            id: "advanced_presence",
            titleKey: "items.advancedPresence",
            descKey: "items.advancedPresenceDesc",
            fields: [{ kind: "boolean", key: "hr_advanced_presence" }],
          },
          {
            id: "skills",
            titleKey: "items.skillsManagement",
            descKey: "items.skillsManagementDesc",
            fields: [{ kind: "boolean", key: "hr_skills" }],
          },
        ],
      },
      {
        id: "work_organization",
        titleKey: "sections.workOrganization",
        items: [
          {
            id: "company_schedule",
            titleKey: "items.companySchedule",
            descKey: "items.companyScheduleDesc",
            fields: [{ kind: "action", labelKey: "actions.companySchedule" }],
          },
        ],
      },
      {
        id: "contract",
        titleKey: "sections.contract",
        items: [
          {
            id: "contract_notice",
            titleKey: "items.contractNotice",
            descKey: "items.contractNoticeDesc",
            fields: [{ kind: "number", key: "hr_contract_notice_days", min: 0, suffixKey: "suffix.days" }],
          },
          {
            id: "work_permit_expiry",
            titleKey: "items.workPermitExpiry",
            descKey: "items.workPermitExpiryDesc",
            fields: [{ kind: "number", key: "hr_work_permit_expiry_days", min: 0, suffixKey: "suffix.days" }],
          },
        ],
      },
    ],
  },
  {
    id: "fleet",
    titleKey: "tabs.fleet",
    icon: "fleet",
    sections: [
      {
        id: "fleet_main",
        titleKey: "sections.fleet",
        items: [
          {
            id: "contract_end_alert",
            titleKey: "items.fleetContractEndAlert",
            descKey: "items.fleetContractEndAlertDesc",
            fields: [
              { kind: "boolean", key: "fleet_contract_end_alert" },
              { kind: "number", key: "fleet_contract_end_days", min: 0, suffixKey: "suffix.days" },
            ],
          },
        ],
      },
    ],
  },
];
