export type MfaProvider = 'native' | 'keycloak' | 'azure_ad' | 'okta' | 'custom_oidc' | 'none';
export type MfaEnforcementMode = 'disabled' | 'app_checked' | 'idp_enforced';
export type UserMfaStatus = 'not_required' | 'not_enrolled' | 'enrolled' | 'managed_by_idp' | 'reset_required';

export type MfaConfigLike = {
  enabled?: boolean;
  provider?: MfaProvider | null;
  enforcement_mode?: MfaEnforcementMode | null;
  required_for_roles?: string[];
  required_for_permissions?: string[];
  claim_mapping?: {
    amr_claim?: string | null;
    acr_claim?: string | null;
    mfa_values?: string[];
  };
  recovery_policy?: {
    allow_admin_reset?: boolean;
    require_audit_note?: boolean;
  };
};

export const DEFAULT_MFA_CONFIG = {
  enabled: false,
  provider: 'none' as MfaProvider,
  enforcement_mode: 'disabled' as MfaEnforcementMode,
  required_for_roles: [] as string[],
  required_for_permissions: [] as string[],
  claim_mapping: {
    amr_claim: 'amr',
    acr_claim: 'acr',
    mfa_values: ['otp', 'webauthn', 'mfa']
  },
  recovery_policy: {
    allow_admin_reset: true,
    require_audit_note: true
  }
};

export function sanitiseMfaConfig(config?: MfaConfigLike | null) {
  return {
    enabled: Boolean(config?.enabled),
    provider: config?.provider ?? 'none',
    enforcement_mode: config?.enforcement_mode ?? 'disabled',
    required_for_roles: config?.required_for_roles ?? [],
    required_for_permissions: config?.required_for_permissions ?? [],
    claim_mapping: {
      amr_claim: config?.claim_mapping?.amr_claim ?? 'amr',
      acr_claim: config?.claim_mapping?.acr_claim ?? 'acr',
      mfa_values: config?.claim_mapping?.mfa_values?.length ? config.claim_mapping.mfa_values : ['otp', 'webauthn', 'mfa']
    },
    recovery_policy: {
      allow_admin_reset: config?.recovery_policy?.allow_admin_reset ?? true,
      require_audit_note: config?.recovery_policy?.require_audit_note ?? true
    }
  };
}

export function getMfaOperationalNotes(config?: MfaConfigLike | null): string[] {
  const safe = sanitiseMfaConfig(config);

  if (!safe.enabled || safe.enforcement_mode === 'disabled') {
    return [
      'MFA policy is stored but not currently enforced for this organisation.',
      'v0.9.1 is MFA-aware only; real MFA challenges are delegated to future native MFA or an external IdP such as Keycloak, Azure Entra ID or Okta.'
    ];
  }

  if (safe.enforcement_mode === 'idp_enforced') {
    return [
      `MFA is expected to be enforced by the configured identity provider: ${safe.provider}.`,
      'The SaaS app will validate MFA-related claims after the future OIDC/SAML login flow is implemented.',
      `Accepted MFA claim values are currently: ${safe.claim_mapping.mfa_values.join(', ')}.`
    ];
  }

  return [
    'MFA is configured for app-checked enforcement, but native MFA challenge flows are not active yet.',
    'Future builds may add TOTP, recovery codes or step-up checks if native MFA is required.'
  ];
}

export function inferUserMfaStatus(mfaConfig?: MfaConfigLike | null, userAuth?: { mfa_status?: UserMfaStatus; mfa_enabled?: boolean; mfa_provider?: string | null }) {
  const safe = sanitiseMfaConfig(mfaConfig);

  if (!safe.enabled || safe.enforcement_mode === 'disabled') {
    return 'not_required' as UserMfaStatus;
  }

  if (safe.enforcement_mode === 'idp_enforced') {
    return 'managed_by_idp' as UserMfaStatus;
  }

  if (userAuth?.mfa_status) {
    return userAuth.mfa_status;
  }

  return userAuth?.mfa_enabled ? 'enrolled' : 'not_enrolled';
}
