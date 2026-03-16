import { createContext, useContext, useState, useEffect } from "react";

const translations = {
  fr: {
    // Navigation
    dashboard: "Tableau de bord",
    transactions: "Transactions",
    categories: "Catégories",
    settings: "Paramètres",
    // Header
    "header.title": "TABLEAU DE BORD KPI",
    "header.subtitle": "Suivi de performance mensuel",
    "header.annualView": "Vue Annuelle",
    "header.monthlyView": "Mensuel",
    // KPI labels
    totalRevenue: "Revenus Totaux",
    netProfit: "Bénéfice Net",
    totalMembers: "Membres Actifs",
    churnRate: "Taux de Churn",
    cac: "CAC",
    roas: "ROAS",
    newMembers: "Nouveaux Membres",
    lostMembers: "Membres Perdus",
    marketingSpend: "Budget Marketing",
    adSpend: "Budget Pub",
    // Months
    "months.january": "Janvier",
    "months.february": "Février",
    "months.march": "Mars",
    "months.april": "Avril",
    "months.may": "Mai",
    "months.june": "Juin",
    "months.july": "Juillet",
    "months.august": "Août",
    "months.september": "Septembre",
    "months.october": "Octobre",
    "months.november": "Novembre",
    "months.december": "Décembre",
    // Currency
    currency: "CHF",
    // Tabs
    revenue: "Revenus",
    funnel: "Acquisition",
    members: "Membres",
    metrics: "Métriques",
    annual: "Annuel",
    // Sections
    "section.keyMetrics": "Métriques Clés",
    "section.revenueEvolution": "Évolution du Revenu",
    "section.monthlyExpenses": "Dépenses Mensuelles Détaillées",
    "section.salesFunnel": "Entonnoir de Vente",
    "section.membersEvolution": "Évolution des Membres",
    "section.additionalMetrics": "Métriques Additionnelles",
    "section.churnRates": "Taux de Désabonnement (Churn)",
    "section.financialSummary": "Résumé Financier",
    // Chart labels
    revenueMembers: "Abonnements",
    revenueCoaching: "Coaching",
    expenses: "Dépenses",
    profit: "Bénéfice",
    loyer: "Loyer",
    salaires: "Salaires",
    utilities: "Charges",
    marketing: "Marketing",
    other: "Autres",
    "chart.totalRevenue": "Revenu Total",
    "chart.profit": "Profit",
    "chart.advertising": "Publicité",
    "chart.rent": "Loyer",
    "chart.software": "Logiciels",
    "chart.subscriptions": "Abonnements",
    "chart.insurance": "Assurance",
    "chart.bankCharges": "Frais bancaires",
    "chart.revenue": "Revenu",
    "chart.expenses": "Dépenses",
    // Metrics
    "metric.totalRevenue": "Revenu Total",
    "metric.profit": "Profit",
    "metric.activeMembers": "Membres Actifs",
    "metric.conversionRate": "Taux de Conversion",
    "metric.cac": "CAC",
    "metric.roAds": "RoAds",
    "metric.totalExpenses": "Dépenses Totales",
    // Transactions
    addTransaction: "Ajouter une transaction",
    date: "Date",
    description: "Description",
    amount: "Montant",
    type: "Type",
    category: "Catégorie",
    subType: "Sous-type",
    actions: "Actions",
    delete: "Supprimer",
    cancel: "Annuler",
    save: "Enregistrer",
    expense: "Dépense",
    revenueType: "Revenu",
    membersType: "Membres",
    coachingType: "Coaching",
    // Recurring transactions
    recurringTransactions: "Transactions Récurrentes",
    addRecurring: "Ajouter une récurrence",
    recurrenceDay: "Jour de récurrence",
    generateMonthly: "Générer le mois",
    active: "Actif",
    inactive: "Inactif",
    toggleStatus: "Activer/Désactiver",
    noRecurring: "Aucune transaction récurrente",
    recurringGenerated: "Transactions générées",
    recurringSkipped: "transactions ignorées (exclues)",
    // Misc
    month: "Mois",
    selectMonth: "Sélectionner un mois",
    noData: "Aucune donnée",
    loading: "Chargement...",
    confirmDelete: "Confirmer la suppression",
    deleteWarning: "Cette transaction sera exclue des récurrences futures.",
    excludedTransactions: "Transactions exclues",
    profitMargin: "Marge Nette",
    vsLastMonth: "vs mois préc.",
    totalExpenses: "Dépenses Totales",
    revenueEvolution: "Évolution des Revenus",
    expensesBreakdown: "Répartition des Dépenses",
    memberVsCoaching: "Membres vs Coaching",
    acquisitionFunnel: "Entonnoir d'Acquisition",
    cacEvolution: "Évolution du CAC",
    membersEvolution: "Évolution des Membres",
    churnEvolution: "Taux de Churn",
    roasEvolution: "Évolution du ROAS",
    profitEvolution: "Bénéfice Net",
    // Buttons
    "button.edit": "Modifier",
    "button.save": "Sauvegarder",
    "button.cancel": "Annuler",
    "button.back": "Retour au tableau de bord",
    // Toasts
    "toast.saved": "Sauvegardé",
    "toast.error": "Erreur",
    "toast.dataUpdated": "Données mises à jour avec succès",
    "toast.cannotSave": "Impossible de sauvegarder",
    // Annual page
    "annual.title": "Synthèse Annuelle",
    "annual.subtitle": "Vue d'ensemble de l'année complète",
    "annual.monthlyEvolutionRevenue": "Évolution Mensuelle des Revenus",
    "annual.monthlyEvolutionMembers": "Évolution Mensuelle des Membres",
    "annual.monthlyFinancial": "Évolution Mensuelle Financière",
    // Filter
    "filter.title": "Filtres",
    "filter.showData": "Afficher les données",
  },
  en: {
    // Navigation
    dashboard: "Dashboard",
    transactions: "Transactions",
    categories: "Categories",
    settings: "Settings",
    // Header
    "header.title": "KPI DASHBOARD",
    "header.subtitle": "Monthly performance tracking",
    "header.annualView": "Annual View",
    "header.monthlyView": "Monthly",
    // KPI labels
    totalRevenue: "Total Revenue",
    netProfit: "Net Profit",
    totalMembers: "Active Members",
    churnRate: "Churn Rate",
    cac: "CAC",
    roas: "ROAS",
    newMembers: "New Members",
    lostMembers: "Lost Members",
    marketingSpend: "Marketing Budget",
    adSpend: "Ad Spend",
    // Months
    "months.january": "January",
    "months.february": "February",
    "months.march": "March",
    "months.april": "April",
    "months.may": "May",
    "months.june": "June",
    "months.july": "July",
    "months.august": "August",
    "months.september": "September",
    "months.october": "October",
    "months.november": "November",
    "months.december": "December",
    // Currency
    currency: "CHF",
    // Tabs
    revenue: "Revenue",
    funnel: "Acquisition",
    members: "Members",
    metrics: "Metrics",
    annual: "Annual",
    // Sections
    "section.keyMetrics": "Key Metrics",
    "section.revenueEvolution": "Revenue Evolution",
    "section.monthlyExpenses": "Detailed Monthly Expenses",
    "section.salesFunnel": "Sales Funnel",
    "section.membersEvolution": "Members Evolution",
    "section.additionalMetrics": "Additional Metrics",
    "section.churnRates": "Churn Rates",
    "section.financialSummary": "Financial Summary",
    // Chart labels
    revenueMembers: "Memberships",
    revenueCoaching: "Coaching",
    expenses: "Expenses",
    profit: "Profit",
    loyer: "Rent",
    salaires: "Salaries",
    utilities: "Utilities",
    marketing: "Marketing",
    other: "Other",
    "chart.totalRevenue": "Total Revenue",
    "chart.profit": "Profit",
    "chart.advertising": "Advertising",
    "chart.rent": "Rent",
    "chart.software": "Software",
    "chart.subscriptions": "Subscriptions",
    "chart.insurance": "Insurance",
    "chart.bankCharges": "Bank Charges",
    "chart.revenue": "Revenue",
    "chart.expenses": "Expenses",
    // Metrics
    "metric.totalRevenue": "Total Revenue",
    "metric.profit": "Profit",
    "metric.activeMembers": "Active Members",
    "metric.conversionRate": "Conversion Rate",
    "metric.cac": "CAC",
    "metric.roAds": "RoAds",
    "metric.totalExpenses": "Total Expenses",
    // Transactions
    addTransaction: "Add Transaction",
    date: "Date",
    description: "Description",
    amount: "Amount",
    type: "Type",
    category: "Category",
    subType: "Sub-type",
    actions: "Actions",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    expense: "Expense",
    revenueType: "Revenue",
    membersType: "Members",
    coachingType: "Coaching",
    // Recurring transactions
    recurringTransactions: "Recurring Transactions",
    addRecurring: "Add Recurring",
    recurrenceDay: "Recurrence Day",
    generateMonthly: "Generate Month",
    active: "Active",
    inactive: "Inactive",
    toggleStatus: "Toggle Status",
    noRecurring: "No recurring transactions",
    recurringGenerated: "Transactions generated",
    recurringSkipped: "transactions skipped (excluded)",
    // Misc
    month: "Month",
    selectMonth: "Select month",
    noData: "No data",
    loading: "Loading...",
    confirmDelete: "Confirm deletion",
    deleteWarning: "This transaction will be excluded from future recurrences.",
    excludedTransactions: "Excluded Transactions",
    profitMargin: "Net Margin",
    vsLastMonth: "vs prev. month",
    totalExpenses: "Total Expenses",
    revenueEvolution: "Revenue Evolution",
    expensesBreakdown: "Expenses Breakdown",
    memberVsCoaching: "Members vs Coaching",
    acquisitionFunnel: "Acquisition Funnel",
    cacEvolution: "CAC Evolution",
    membersEvolution: "Members Evolution",
    churnEvolution: "Churn Rate",
    roasEvolution: "ROAS Evolution",
    profitEvolution: "Net Profit",
    // Buttons
    "button.edit": "Edit",
    "button.save": "Save",
    "button.cancel": "Cancel",
    "button.back": "Back to dashboard",
    // Toasts
    "toast.saved": "Saved",
    "toast.error": "Error",
    "toast.dataUpdated": "Data updated successfully",
    "toast.cannotSave": "Cannot save",
    // Annual page
    "annual.title": "Annual Summary",
    "annual.subtitle": "Complete year overview",
    "annual.monthlyEvolutionRevenue": "Monthly Revenue Evolution",
    "annual.monthlyEvolutionMembers": "Monthly Members Evolution",
    "annual.monthlyFinancial": "Monthly Financial Evolution",
    // Filter
    "filter.title": "Filters",
    "filter.showData": "Show data",
  },
};

const LanguageContext = createContext({
  lang: "fr",
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState("fr");
  
  useEffect(() => {
    const saved = localStorage.getItem("kpi-lang");
    if (saved) setLangState(saved);
  }, []);
  
  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem("kpi-lang", newLang);
  };
  
  const t = (key) => translations[lang][key] || key;
  
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

