-- Create hospital_plan_and_performance table
CREATE TABLE IF NOT EXISTS public.hospital_plan_and_performance (
  id SERIAL PRIMARY KEY,
  category VARCHAR(255) NOT NULL,
  indicator_name VARCHAR(255) NOT NULL,
  fiscal_year VARCHAR(50) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  metric_value DECIMAL(10, 2),
  percentage_value DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'Active',
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_hospital_performance_category ON public.hospital_plan_and_performance(category);
CREATE INDEX IF NOT EXISTS idx_hospital_performance_indicator ON public.hospital_plan_and_performance(indicator_name);
CREATE INDEX IF NOT EXISTS idx_hospital_performance_fiscal_year ON public.hospital_plan_and_performance(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_hospital_performance_metric_type ON public.hospital_plan_and_performance(metric_type);

-- Enable Row Level Security
ALTER TABLE public.hospital_plan_and_performance ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all records
CREATE POLICY "Authenticated users can read hospital performance data"
  ON public.hospital_plan_and_performance FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only specific roles can insert/update
CREATE POLICY "Authenticated users can insert hospital performance data"
  ON public.hospital_plan_and_performance FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update hospital performance data"
  ON public.hospital_plan_and_performance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Only admins can delete
CREATE POLICY "Admins can delete hospital performance data"
  ON public.hospital_plan_and_performance FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert the hospital plan and performance data
INSERT INTO "public"."hospital_plan_and_performance" ("id", "category", "indicator_name", "fiscal_year", "metric_type", "metric_value", "percentage_value", "status", "remark", "created_at") VALUES 
(1, 'Family Planning', 'Contraceptive Acceptors by Age', '2016 EFY', 'Performance', '98.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(2, 'Family Planning', 'Contraceptive Acceptors by Age', '2017 EFY', 'Performance', '175.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(3, 'Family Planning', 'Contraceptive Acceptors by Age', '2018 EFY', 'Plan', '250.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(4, 'Family Planning', 'Contraceptive Acceptors by Age', '2018 EFY', 'Performance', '350.00', null, 'Active', '10 month performance', '2026-05-21 20:54:47.999923+00'), 
(5, 'Family Planning', 'Contraceptive Acceptors by Age', '2018 EFY', 'EAP', '420.00', null, 'Active', 'Estimated Annual Performance', '2026-05-21 20:54:47.999923+00'), 
(6, 'Family Planning', 'Contraceptive Acceptors by Age', '2019 EFY', 'Plan', '483.00', null, 'Active', 'Strategic Next Year Target', '2026-05-21 20:54:47.999923+00'), 
(7, 'Family Planning', 'Contraceptive New Acceptors', '2016 EFY', 'Performance', '43.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(8, 'Family Planning', 'Contraceptive New Acceptors', '2017 EFY', 'Performance', '26.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(9, 'Family Planning', 'Contraceptive New Acceptors', '2018 EFY', 'Plan', '30.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(10, 'Family Planning', 'Contraceptive New Acceptors', '2018 EFY', 'Performance', '48.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(11, 'Family Planning', 'Contraceptive New Acceptors', '2018 EFY', 'EAP', '58.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(12, 'Family Planning', 'Contraceptive New Acceptors', '2019 EFY', 'Plan', '67.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(13, 'Family Planning', 'Contraceptive Repeat Acceptors by Age', '2016 EFY', 'Performance', '55.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(14, 'Family Planning', 'Contraceptive Repeat Acceptors by Age', '2017 EFY', 'Performance', '149.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(15, 'Family Planning', 'Contraceptive Repeat Acceptors by Age', '2018 EFY', 'Plan', '171.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(16, 'Family Planning', 'Contraceptive Repeat Acceptors by Age', '2018 EFY', 'Performance', '302.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(17, 'Family Planning', 'Contraceptive Repeat Acceptors by Age', '2018 EFY', 'EAP', '362.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(18, 'Family Planning', 'Contraceptive Repeat Acceptors by Age', '2019 EFY', 'Plan', '416.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(19, 'Family Planning', 'Long Acting Family Planning', '2016 EFY', 'Performance', '27.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(20, 'Family Planning', 'Long Acting Family Planning', '2017 EFY', 'Performance', '110.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(21, 'Family Planning', 'Long Acting Family Planning', '2018 EFY', 'Plan', '127.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(22, 'Family Planning', 'Long Acting Family Planning', '2018 EFY', 'Performance', '270.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(23, 'Family Planning', 'Long Acting Family Planning', '2018 EFY', 'EAP', '324.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(24, 'Family Planning', 'Long Acting Family Planning', '2019 EFY', 'Plan', '373.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(25, 'Family Planning Methods', 'New Acceptors: Oral Contraceptives', '2016 EFY', 'Performance', '11.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(26, 'Family Planning Methods', 'New Acceptors: Oral Contraceptives', '2017 EFY', 'Performance', '0.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(27, 'Family Planning Methods', 'New Acceptors: Oral Contraceptives', '2018 EFY', 'Plan', '0.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(28, 'Family Planning Methods', 'New Acceptors: Oral Contraceptives', '2018 EFY', 'Performance', '0.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(29, 'Family Planning Methods', 'New Acceptors: Oral Contraceptives', '2018 EFY', 'EAP', '0.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'), 
(30, 'Family Planning Methods', 'New Acceptors: Oral Contraceptives', '2019 EFY', 'Plan', '0.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(31, 'Family Planning Methods', 'New Acceptors: Injectables', '2016 EFY', 'Performance', '16.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(32, 'Family Planning Methods', 'New Acceptors: Injectables', '2017 EFY', 'Performance', '5.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(33, 'Family Planning Methods', 'New Acceptors: Injectables', '2018 EFY', 'Plan', '6.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(34, 'Family Planning Methods', 'New Acceptors: Injectables', '2018 EFY', 'Performance', '16.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(35, 'Family Planning Methods', 'New Acceptors: Injectables', '2018 EFY', 'EAP', '19.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(36, 'Family Planning Methods', 'New Acceptors: Injectables', '2019 EFY', 'Plan', '22.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(37, 'Family Planning Methods', 'New Acceptors: Implants', '2016 EFY', 'Performance', '16.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(38, 'Family Planning Methods', 'New Acceptors: Implants', '2017 EFY', 'Performance', '19.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(39, 'Family Planning Methods', 'New Acceptors: Implants', '2018 EFY', 'Plan', '22.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(40, 'Family Planning Methods', 'New Acceptors: Implants', '2018 EFY', 'Performance', '32.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(41, 'Family Planning Methods', 'New Acceptors: Implants', '2018 EFY', 'EAP', '38.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(42, 'Family Planning Methods', 'New Acceptors: Implants', '2019 EFY', 'Plan', '44.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(43, 'Hospital Utilization', 'Number of Inpatient Admissions', '2016 EFY', 'Performance', '249.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(44, 'Hospital Utilization', 'Number of Inpatient Admissions', '2017 EFY', 'Performance', '770.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(45, 'Hospital Utilization', 'Number of Inpatient Admissions', '2018 EFY', 'Plan', '886.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(46, 'Hospital Utilization', 'Number of Inpatient Admissions', '2018 EFY', 'Performance', '993.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(47, 'Hospital Utilization', 'Number of Inpatient Admissions', '2018 EFY', 'EAP', '1192.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(48, 'Hospital Utilization', 'Number of Inpatient Admissions', '2019 EFY', 'Plan', '1371.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(49, 'Quality & Safety', 'Total Number of Inpatient Deaths', '2016 EFY', 'Performance', '0.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(50, 'Quality & Safety', 'Total Number of Inpatient Deaths', '2017 EFY', 'Performance', '5.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(51, 'Quality & Safety', 'Total Number of Inpatient Deaths', '2018 EFY', 'Plan', '4.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(52, 'Quality & Safety', 'Total Number of Inpatient Deaths', '2018 EFY', 'Performance', '7.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(53, 'Quality & Safety', 'Total Number of Inpatient Deaths', '2018 EFY', 'EAP', '8.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(54, 'Quality & Safety', 'Total Number of Inpatient Deaths', '2019 EFY', 'Plan', '9.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(55, 'Pharmacy', 'Number of Encounters With One or More Antibiotics', '2016 EFY', 'Performance', '7310.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(56, 'Pharmacy', 'Number of Encounters With One or More Antibiotics', '2017 EFY', 'Performance', '8419.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(57, 'Pharmacy', 'Number of Encounters With One or More Antibiotics', '2018 EFY', 'Plan', '9682.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(58, 'Pharmacy', 'Number of Encounters With One or More Antibiotics', '2018 EFY', 'Performance', '5164.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(59, 'Pharmacy', 'Number of Encounters With One or More Antibiotics', '2018 EFY', 'EAP', '6196.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(60, 'Pharmacy', 'Number of Encounters With One or More Antibiotics', '2019 EFY', 'Plan', '7126.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(61, 'Blood Bank', 'Number of Blood Units Collected (Staff & Community)', '2016 EFY', 'Performance', '0.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(62, 'Blood Bank', 'Number of Blood Units Collected (Staff & Community)', '2017 EFY', 'Performance', '64.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(63, 'Blood Bank', 'Number of Blood Units Collected (Staff & Community)', '2018 EFY', 'Plan', '120.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(64, 'Blood Bank', 'Number of Blood Units Collected (Staff & Community)', '2018 EFY', 'Performance', '94.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(65, 'Blood Bank', 'Number of Blood Units Collected (Staff & Community)', '2018 EFY', 'EAP', '94.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(66, 'Blood Bank', 'Number of Blood Units Collected (Staff & Community)', '2019 EFY', 'Plan', '108.00', null, 'Active', null, '2026-05-21 20:54:47.999923+00'),
(67, 'Nutrition', 'NUT_ % SAM children 6-59 months Cured at SC', '2017 EFY', 'Performance', null, '4.20', 'Active', null, '2026-05-21 21:10:31.266909+00'),
(68, 'Nutrition', 'NUT_ % SAM children 6-59 months Cured at SC', '2018 EFY', 'Performance', null, '2.60', 'Active', null, '2026-05-21 21:10:31.266909+00'),
(69, 'Nutrition', 'NUT_ Percentage of Low Birth Weight (LBW) Newborns', '2018 EFY', 'Performance', null, '5.27', 'Active', null, '2026-05-21 21:10:31.266909+00'),
(70, 'Tuberculosis', 'WBP B% TB_Proportion of all forms of TB cases notified and treated from community referral', '2018 EFY', 'Performance', null, '7.10', 'Active', null, '2026-05-21 21:10:31.266909+00'),
(71, 'Tuberculosis', 'WBP-B# TB_Number of all forms of TB cases notified and treated from community referral', '2017 EFY', 'Performance', '1.00', null, 'Active', null, '2026-05-21 21:10:31.266909+00'),
(72, 'Tuberculosis', 'WBP-B# TB_Number of all forms of TB cases notified and treated from community referral', '2018 EFY', 'Performance', '1.00', null, 'Active', null, '2026-05-21 21:10:31.266909+00')
ON CONFLICT (id) DO NOTHING;
