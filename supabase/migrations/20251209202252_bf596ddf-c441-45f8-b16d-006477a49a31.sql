-- Add requires_training_tracking field to accounting_categories
ALTER TABLE public.accounting_categories
ADD COLUMN requires_training_tracking BOOLEAN NOT NULL DEFAULT false;

-- Set default values for existing memberships that require training tracking
UPDATE public.accounting_categories
SET requires_training_tracking = true
WHERE name IN (
  'THE COACH PASS MENSUEL',
  'HUBFIT',
  'UNLIMITED ACCESS - PAIEMENT MENSUEL',
  'UNLIMITED ACCESS - PAIEMENT X1 - ANNUEL',
  'UNLIMITED ACCESS DUO - PAIEMENT MENSUEL',
  'UNLIMITED ACCESS DUO - PAIEMENT ANNUEL X1',
  'OFFRE 6 MOIS - 499 CHF',
  'UNLIMITED ACCESS SANS EMGAGEMENT - PAIEMENT MENSUEL',
  'PT ANTOINE',
  'OFFRE 3 MOIS',
  '6 WEEKS CHALLENGE'
);