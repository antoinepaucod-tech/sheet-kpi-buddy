import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import {
  Shield,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STEPS = [
  {
    num: 1,
    title: "Ouvrir le Graph API Explorer",
    desc: "Connectez-vous avec votre compte Facebook qui gère les publicités.",
    link: "https://developers.facebook.com/tools/explorer/",
    linkLabel: "Ouvrir Graph API Explorer",
  },
  {
    num: 2,
    title: "Sélectionner votre application Meta",
    desc: "En haut à droite du Explorer, choisissez votre application (ex: Hybrid Gym). Si elle n'apparaît pas, vérifiez que vous êtes bien admin de l'app.",
    link: null,
  },
  {
    num: 3,
    title: "Ajouter la permission 'ads_read'",
    desc: "Cliquez sur 'Permissions' puis cochez 'ads_read'. Cette permission permet de lire les données publicitaires (dépenses, impressions, clics).",
    link: null,
  },
  {
    num: 4,
    title: "Générer le token",
    desc: "Cliquez sur 'Generate Access Token'. Acceptez les autorisations demandées. Vous obtenez un token de courte durée (~1h).",
    link: null,
  },
  {
    num: 5,
    title: "Échanger pour un token longue durée (60 jours)",
    desc: "Allez dans l'Access Token Debugger, collez votre token, puis cliquez sur 'Extend Access Token' en bas de page. Copiez le nouveau token généré.",
    link: "https://developers.facebook.com/tools/debug/accesstoken/",
    linkLabel: "Ouvrir Access Token Debugger",
  },
  {
    num: 6,
    title: "Transmettre le nouveau token",
    desc: "Envoyez le nouveau token longue durée à votre développeur pour mise à jour dans l'application. Le token sera actif pendant 60 jours.",
    link: null,
  },
];

export default function MetaHelpPage() {
  const { user } = useAuth();
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get(`${API}/meta/token-info`);
        setTokenInfo(res.data);
      } catch {
        setTokenInfo({ configured: false });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (user?.role !== "super_admin") {
    return (
      <div className="tf-card" style={{ textAlign: "center", padding: "3rem" }}>
        <Shield size={48} style={{ color: "var(--color-text-tertiary)", margin: "0 auto 1rem" }} />
        <h2 style={{ color: "var(--color-text-primary)" }}>Accès réservé</h2>
      </div>
    );
  }

  const copyAppId = () => {
    if (tokenInfo?.app_id) {
      navigator.clipboard.writeText(tokenInfo.app_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusColor =
    !tokenInfo?.configured ? "#6b7280"
    : tokenInfo?.is_valid && tokenInfo?.days_remaining > 14 ? "#22c55e"
    : tokenInfo?.is_valid && tokenInfo?.days_remaining > 0 ? "#f59e0b"
    : "#ef4444";

  const StatusIcon =
    !tokenInfo?.configured ? XCircle
    : tokenInfo?.is_valid && tokenInfo?.days_remaining > 14 ? CheckCircle2
    : tokenInfo?.is_valid ? AlertTriangle
    : XCircle;

  return (
    <div className="space-y-6" data-testid="meta-help-page">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--color-text-primary)" }}>
          Meta Ads — Configuration
        </h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", marginTop: "0.25rem" }}>
          Guide de renouvellement du token et liens utiles
        </p>
      </div>

      {/* Token Status Card */}
      <div
        className="tf-card"
        style={{ padding: "1.25rem", border: `1px solid ${statusColor}30` }}
        data-testid="meta-token-status"
      >
        <div className="flex items-start gap-4">
          <div
            style={{
              width: 48, height: 48, borderRadius: "var(--radius-md)",
              background: `${statusColor}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={22} style={{ color: statusColor }} />
            ) : (
              <StatusIcon size={22} style={{ color: statusColor }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
              Statut du Token
            </h2>
            {loading ? (
              <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>Vérification en cours...</p>
            ) : !tokenInfo?.configured ? (
              <p style={{ color: "#ef4444", fontSize: "var(--text-sm)" }}>Aucun token configuré</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-x-8 gap-y-2" style={{ fontSize: "var(--text-sm)" }}>
                  <div>
                    <span style={{ color: "var(--color-text-tertiary)" }}>État : </span>
                    <span style={{ color: statusColor, fontWeight: "var(--font-semibold)" }}>
                      {tokenInfo.is_valid ? "Actif" : "Expiré / Invalide"}
                    </span>
                  </div>
                  {tokenInfo.days_remaining !== undefined && (
                    <div>
                      <span style={{ color: "var(--color-text-tertiary)" }}>Expire dans : </span>
                      <span style={{ color: statusColor, fontWeight: "var(--font-semibold)" }}>
                        {tokenInfo.days_remaining > 0 ? `${tokenInfo.days_remaining} jours` : "Expiré"}
                      </span>
                    </div>
                  )}
                  {tokenInfo.expires_at && (
                    <div>
                      <span style={{ color: "var(--color-text-tertiary)" }}>Date : </span>
                      <span style={{ color: "var(--color-text-secondary)" }}>
                        {new Date(tokenInfo.expires_at).toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-2" style={{ fontSize: "var(--text-sm)" }}>
                  <div>
                    <span style={{ color: "var(--color-text-tertiary)" }}>App ID : </span>
                    <span style={{ color: "var(--color-text-secondary)", fontFamily: "monospace" }}>{tokenInfo.app_id}</span>
                    <button onClick={copyAppId} style={{ marginLeft: 6, color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", verticalAlign: "middle" }}>
                      <Copy size={12} />
                    </button>
                    {copied && <span style={{ color: "#22c55e", fontSize: "11px", marginLeft: 4 }}>Copié</span>}
                  </div>
                  <div>
                    <span style={{ color: "var(--color-text-tertiary)" }}>Ad Account : </span>
                    <span style={{ color: "var(--color-text-secondary)", fontFamily: "monospace" }}>{tokenInfo.ad_account_id}</span>
                  </div>
                </div>
                {tokenInfo.scopes?.length > 0 && (
                  <div style={{ fontSize: "var(--text-sm)" }}>
                    <span style={{ color: "var(--color-text-tertiary)" }}>Permissions : </span>
                    <span style={{ color: "var(--color-text-secondary)" }}>{tokenInfo.scopes.join(", ")}</span>
                  </div>
                )}
                {tokenInfo.token_preview && (
                  <div style={{ fontSize: "var(--text-sm)" }}>
                    <span style={{ color: "var(--color-text-tertiary)" }}>Token : </span>
                    <span style={{ color: "var(--color-text-secondary)", fontFamily: "monospace", fontSize: "12px" }}>{tokenInfo.token_preview}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expiration Warning */}
      {tokenInfo?.is_valid && tokenInfo?.days_remaining <= 14 && tokenInfo?.days_remaining > 0 && (
        <div
          className="tf-card"
          style={{ padding: "0.75rem 1.25rem", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: "#f59e0b" }} />
            <span style={{ fontSize: "var(--text-sm)", color: "#f59e0b", fontWeight: "var(--font-semibold)" }}>
              Attention : votre token expire dans {tokenInfo.days_remaining} jours. Renouvelez-le en suivant les étapes ci-dessous.
            </span>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="tf-card" style={{ padding: "1.25rem" }} data-testid="meta-quick-links">
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)", marginBottom: "1rem" }}>
          Liens Rapides
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLink
            label="Graph API Explorer"
            desc="Générer un nouveau token"
            url="https://developers.facebook.com/tools/explorer/"
          />
          <QuickLink
            label="Access Token Debugger"
            desc="Vérifier et prolonger un token"
            url="https://developers.facebook.com/tools/debug/accesstoken/"
          />
          <QuickLink
            label="Paramètres de l'App"
            desc="Gérer votre application Meta"
            url={`https://developers.facebook.com/apps/${tokenInfo?.app_id || ""}/settings/basic/`}
          />
          <QuickLink
            label="Ads Manager"
            desc="Voir vos campagnes publicitaires"
            url={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${tokenInfo?.ad_account_id || ""}`}
          />
        </div>
      </div>

      {/* Step-by-step Guide */}
      <div className="tf-card" style={{ padding: "1.25rem" }} data-testid="meta-guide-steps">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} style={{ color: "var(--color-accent)" }} />
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)" }}>
            Comment renouveler le token (5 min)
          </h2>
        </div>
        <div className="space-y-1">
          {STEPS.map((step) => (
            <StepItem key={step.num} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickLink({ label, desc, url }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.75rem 1rem", borderRadius: "var(--radius-md)",
        background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)",
        textDecoration: "none", transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)" }}>
          {label}
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>{desc}</div>
      </div>
      <ExternalLink size={14} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
    </a>
  );
}

function StepItem({ step }) {
  return (
    <div
      style={{
        display: "flex", gap: "1rem", padding: "1rem 0",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: "var(--color-accent)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "var(--text-sm)", fontWeight: "var(--font-bold)",
        }}
      >
        {step.num}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)", marginBottom: "0.25rem" }}>
          {step.title}
        </h3>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          {step.desc}
        </p>
        {step.link && (
          <a
            href={step.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1"
            style={{
              marginTop: "0.5rem", fontSize: "var(--text-sm)", color: "var(--color-accent)",
              textDecoration: "none", fontWeight: "var(--font-medium)",
            }}
          >
            {step.linkLabel} <ChevronRight size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
