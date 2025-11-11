-- Populate schedule_templates with default schedule
INSERT INTO schedule_templates (day_of_week, time_slot, course_name, instructor_name) VALUES
  ('Lundi', '6h30', 'Hyrox Engine', NULL),
  ('Lundi', '8h', 'Hyrox Power', NULL),
  ('Lundi', '9h', 'Hyrox Complete', NULL),
  ('Lundi', '12h15', 'Hyrox Foundational', NULL),
  ('Lundi', '18h30', 'Strength', NULL),
  ('Lundi', '19h30', 'Hyrox Engine', NULL),
  
  ('Mardi', '6h30', 'Hyrox Power', NULL),
  ('Mardi', '8h', 'Hyrox Complete', NULL),
  ('Mardi', '9h', 'IFRC Mobility', NULL),
  ('Mardi', '12h15', 'Strength', NULL),
  ('Mardi', '18h30', 'Hyrox Engine', NULL),
  ('Mardi', '19h30', 'Hyrox Power', NULL),
  
  ('Mercredi', '6h30', 'Hyrox Complete', NULL),
  ('Mercredi', '8h', 'Hyrox Foundational', NULL),
  ('Mercredi', '9h', 'Mobility', NULL),
  ('Mercredi', '12h15', 'Hyrox Engine', NULL),
  ('Mercredi', '18h30', 'Hyrox Power', NULL),
  ('Mercredi', '19h30', 'Strength', NULL),
  
  ('Jeudi', '6h30', 'Hyrox Engine', NULL),
  ('Jeudi', '8h', 'Hyrox Power', NULL),
  ('Jeudi', '9h', 'Yoga', NULL),
  ('Jeudi', '12h15', 'Hyrox Complete', NULL),
  ('Jeudi', '18h30', 'Hyrox Foundational', NULL),
  ('Jeudi', '19h30', 'Hyrox Engine', NULL),
  
  ('Vendredi', '6h30', 'Hyrox Power', NULL),
  ('Vendredi', '8h', 'Strength', NULL),
  ('Vendredi', '9h', 'IFRC Mobility', NULL),
  ('Vendredi', '12h15', 'Hyrox Engine', NULL),
  ('Vendredi', '18h30', 'Hyrox Complete', NULL),
  ('Vendredi', '19h30', 'Hyrox Power', NULL),
  
  ('Samedi', '8h', 'Hyrox Engine', NULL),
  ('Samedi', '9h', 'Hyrox Complete', NULL),
  ('Samedi', '12h15', 'Mobility', NULL),
  
  ('Dimanche', '9h', 'Hyrox Foundational', NULL),
  ('Dimanche', '12h15', 'Yoga', NULL);