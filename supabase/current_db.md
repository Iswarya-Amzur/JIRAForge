create table public.activity_log (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid null,
  event_type text not null,
  event_data jsonb null default '{}'::jsonb,
  ip_address inet null,
  user_agent text null,
  created_at timestamp with time zone null default now(),
  constraint activity_log_pkey primary key (id),
  constraint activity_log_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;


create index IF not exists idx_activity_log_user_id on public.activity_log using btree (user_id) TABLESPACE pg_default;


create index IF not exists idx_activity_log_event_type on public.activity_log using btree (event_type) TABLESPACE pg_default;


create index IF not exists idx_activity_log_created_at on public.activity_log using btree (created_at desc) TABLESPACE pg_default;






















create table public.analysis_results (
  id uuid not null default extensions.uuid_generate_v4 (),
  screenshot_id uuid not null,
  user_id uuid not null,
  time_spent_seconds integer not null default 0,
  active_task_key text null,
  active_project_key text null,
  confidence_score numeric(3, 2) null,
  extracted_text text null,
  detected_jira_keys text[] null,
  is_active_work boolean null default true,
  is_idle boolean null default false,
  analyzed_by text null default 'ai'::text,
  ai_model_version text null,
  analysis_metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  worklog_created boolean null default false,
  worklog_id text null,
  worklog_created_at timestamp with time zone null,
  work_type text not null,
  manually_assigned boolean null default false,
  assignment_group_id uuid null,
  constraint analysis_results_pkey primary key (id),
  constraint analysis_results_screenshot_id_fkey foreign KEY (screenshot_id) references screenshots (id) on delete CASCADE,
  constraint analysis_results_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint analysis_results_confidence_score_check check (
    (
      (confidence_score >= (0)::numeric)
      and (confidence_score <= (1)::numeric)
    )
  ),
  constraint analysis_results_work_type_check check (
    (
      work_type = any (array['office'::text, 'non-office'::text])
    )
  )
) TABLESPACE pg_default;


create index IF not exists idx_analysis_results_screenshot_id on public.analysis_results using btree (screenshot_id) TABLESPACE pg_default;


create index IF not exists idx_analysis_results_user_id on public.analysis_results using btree (user_id) TABLESPACE pg_default;


create index IF not exists idx_analysis_results_task_key on public.analysis_results using btree (active_task_key) TABLESPACE pg_default;


create index IF not exists idx_analysis_results_project_key on public.analysis_results using btree (active_project_key) TABLESPACE pg_default;


create index IF not exists idx_analysis_results_worklog on public.analysis_results using btree (worklog_created, user_id) TABLESPACE pg_default;


create index IF not exists idx_analysis_results_work_type on public.analysis_results using btree (work_type) TABLESPACE pg_default;


create index IF not exists idx_analysis_results_unassigned on public.analysis_results using btree (user_id, active_task_key) TABLESPACE pg_default
where
  (active_task_key is null);


create index IF not exists idx_analysis_results_manual_assignment on public.analysis_results using btree (manually_assigned, assignment_group_id) TABLESPACE pg_default;


create index IF not exists idx_analysis_results_user_date_unassigned on public.analysis_results using btree (user_id, created_at desc) TABLESPACE pg_default
where
  (
    (active_task_key is null)
    and (work_type = 'office'::text)
  );


create index IF not exists idx_analysis_results_assignment_group on public.analysis_results using btree (assignment_group_id) TABLESPACE pg_default
where
  (assignment_group_id is not null);


create trigger trigger_auto_save_unassigned
after INSERT
or
update on analysis_results for EACH row
execute FUNCTION auto_save_unassigned_activity ();






































create table public.created_issues_log (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid null,
  issue_key character varying(50) not null,
  issue_summary text null,
  assignment_group_id uuid null,
  session_count integer null,
  total_time_seconds integer null,
  created_at timestamp with time zone null default now(),
  constraint created_issues_log_pkey primary key (id),
  constraint created_issues_log_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;


create index IF not exists idx_created_issues_user on public.created_issues_log using btree (user_id, created_at desc) TABLESPACE pg_default;


























create view public.daily_time_summary as
select
  ar.user_id,
  u.display_name as user_display_name,
  date (s."timestamp") as work_date,
  ar.active_project_key,
  ar.active_task_key,
  count(distinct s.id) as screenshot_count,
  sum(ar.time_spent_seconds) as total_seconds,
  round(sum(ar.time_spent_seconds)::numeric / 3600.0, 2) as total_hours,
  avg(ar.confidence_score) as avg_confidence
from
  analysis_results ar
  join screenshots s on s.id = ar.screenshot_id
  left join users u on u.id = ar.user_id
where
  ar.work_type = 'office'::text
group by
  ar.user_id,
  u.display_name,
  (date (s."timestamp")),
  ar.active_project_key,
  ar.active_task_key
order by
  (date (s."timestamp")) desc,
  ar.user_id,
  ar.active_project_key,
  ar.active_task_key;















create table public.documents (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  file_name text not null,
  file_type text not null,
  file_size_bytes bigint not null,
  storage_url text not null,
  storage_path text not null,
  processing_status text null default 'uploaded'::text,
  extracted_text text null,
  parsed_requirements jsonb null,
  project_key text null,
  created_issues jsonb null default '[]'::jsonb,
  error_message text null,
  created_at timestamp with time zone null default now(),
  processed_at timestamp with time zone null,
  ai_model_version text null,
  processing_metadata jsonb null default '{}'::jsonb,
  constraint documents_pkey primary key (id),
  constraint documents_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint documents_file_type_check check (
    (
      file_type = any (array['pdf'::text, 'docx'::text, 'doc'::text])
    )
  ),
  constraint documents_processing_status_check check (
    (
      processing_status = any (
        array[
          'uploaded'::text,
          'extracting'::text,
          'analyzing'::text,
          'completed'::text,
          'failed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;


create index IF not exists idx_documents_user_id on public.documents using btree (user_id) TABLESPACE pg_default;


create index IF not exists idx_documents_status on public.documents using btree (processing_status) TABLESPACE pg_default;


create index IF not exists idx_documents_created_at on public.documents using btree (created_at desc) TABLESPACE pg_default;


create index IF not exists idx_documents_project_key on public.documents using btree (project_key) TABLESPACE pg_default;


create trigger "BRD Processing"
after INSERT on documents for EACH row
execute FUNCTION supabase_functions.http_request (
  'https://rotten-peas-care.loca.lt/api/process-brd',
  'POST',
  '{"Content-type":"application/json","Authorization":"dev-api-key"}',
  '{}',
  '9946'
);






















create view public.monthly_time_summary as
select
  ar.user_id,
  u.display_name as user_display_name,
  date_trunc('month'::text, s."timestamp")::date as month_start,
  ar.active_project_key,
  ar.active_task_key,
  count(distinct s.id) as screenshot_count,
  sum(ar.time_spent_seconds) as total_seconds,
  round(sum(ar.time_spent_seconds)::numeric / 3600.0, 2) as total_hours,
  avg(ar.confidence_score) as avg_confidence
from
  analysis_results ar
  join screenshots s on s.id = ar.screenshot_id
  left join users u on u.id = ar.user_id
where
  ar.work_type = 'office'::text
group by
  ar.user_id,
  u.display_name,
  (date_trunc('month'::text, s."timestamp")),
  ar.active_project_key,
  ar.active_task_key
order by
  (date_trunc('month'::text, s."timestamp")::date) desc,
  ar.user_id,
  ar.active_project_key,
  ar.active_task_key;















create view public.project_time_summary as
select
  ar.user_id,
  ar.active_project_key,
  sum(ar.time_spent_seconds) as total_seconds,
  count(distinct ar.active_task_key) as unique_tasks,
  count(distinct s.id) as screenshot_count,
  min(s."timestamp") as first_activity,
  max(s."timestamp") as last_activity
from
  analysis_results ar
  join screenshots s on s.id = ar.screenshot_id
where
  ar.is_active_work = true
  and ar.is_idle = false
  and ar.active_project_key is not null
group by
  ar.user_id,
  ar.active_project_key;
























create table public.screenshots (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  timestamp timestamp with time zone not null,
  storage_url text not null,
  storage_path text not null,
  thumbnail_url text null,
  window_title text null,
  application_name text null,
  file_size_bytes bigint null,
  status text null default 'pending'::text,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  analyzed_at timestamp with time zone null,
  deleted_at timestamp with time zone null,
  user_assigned_issues jsonb null default '[]'::jsonb,
  constraint screenshots_pkey primary key (id),
  constraint screenshots_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint screenshots_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'processing'::text,
          'analyzed'::text,
          'failed'::text,
          'deleted'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;


create index IF not exists idx_screenshots_user_id on public.screenshots using btree (user_id) TABLESPACE pg_default;


create index IF not exists idx_screenshots_timestamp on public.screenshots using btree ("timestamp" desc) TABLESPACE pg_default;


create index IF not exists idx_screenshots_status on public.screenshots using btree (status) TABLESPACE pg_default;


create index IF not exists idx_screenshots_user_timestamp on public.screenshots using btree (user_id, "timestamp" desc) TABLESPACE pg_default;


create trigger "Screenshot Analysis"
after INSERT on screenshots for EACH row
execute FUNCTION supabase_functions.http_request (
  'https://jvijitdewbypqbatfboi.supabase.co/functions/v1/screenshot-webhook',
  'POST',
  '{}',
  '{}',
  '10000'
);


create trigger "screenshot-webhook"
after INSERT
or
update on screenshots for EACH row
execute FUNCTION supabase_functions.http_request (
  'https://jvijitdewbypqbatfboi.supabase.co/functions/v1/screenshot-webhook',
  'POST',
  '{"Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aWppdGRld2J5cHFiYXRmYm9pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjc1NTU5MCwiZXhwIjoyMDc4MzMxNTkwfQ.2Pbdo2DHHfCIpUVPP390P2Y3rF7_hdsYM-38g26XTUY"}',
  '{}',
  '5000'
);














create table public.unassigned_activity (
  id uuid not null default extensions.uuid_generate_v4 (),
  analysis_result_id uuid not null,
  screenshot_id uuid not null,
  user_id uuid not null,
  timestamp timestamp with time zone not null,
  window_title text null,
  application_name text null,
  extracted_text text null,
  detected_jira_keys text[] null,
  confidence_score numeric(3, 2) null,
  time_spent_seconds integer null default 0,
  reason text null,
  manually_assigned boolean null default false,
  assigned_task_key text null,
  assigned_by uuid null,
  assigned_at timestamp with time zone null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  constraint unassigned_activity_pkey primary key (id),
  constraint unassigned_activity_analysis_result_id_key unique (analysis_result_id),
  constraint unassigned_activity_assigned_by_fkey foreign KEY (assigned_by) references users (id),
  constraint unassigned_activity_analysis_result_id_fkey foreign KEY (analysis_result_id) references analysis_results (id) on delete CASCADE,
  constraint unassigned_activity_screenshot_id_fkey foreign KEY (screenshot_id) references screenshots (id) on delete CASCADE,
  constraint unassigned_activity_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint unassigned_activity_reason_check check (
    (
      reason = any (
        array[
          'no_task_key'::text,
          'invalid_task_key'::text,
          'low_confidence'::text,
          'manual_override'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;


create index IF not exists idx_unassigned_activity_user_id on public.unassigned_activity using btree (user_id) TABLESPACE pg_default;


create index IF not exists idx_unassigned_activity_timestamp on public.unassigned_activity using btree ("timestamp" desc) TABLESPACE pg_default;


create index IF not exists idx_unassigned_activity_manually_assigned on public.unassigned_activity using btree (manually_assigned) TABLESPACE pg_default;


create index IF not exists idx_unassigned_activity_screenshot_id on public.unassigned_activity using btree (screenshot_id) TABLESPACE pg_default;




























create view public.unassigned_activity_summary as
select
  ua.user_id,
  u.email as user_email,
  u.display_name as user_name,
  count(*) as unassigned_count,
  sum(ua.time_spent_seconds) as total_unassigned_seconds,
  round(sum(ua.time_spent_seconds)::numeric / 3600.0, 2) as total_unassigned_hours,
  count(*) filter (
    where
      ua.manually_assigned = true
  ) as manually_assigned_count,
  count(*) filter (
    where
      ua.manually_assigned = false
  ) as pending_assignment_count
from
  unassigned_activity ua
  join users u on u.id = ua.user_id
group by
  ua.user_id,
  u.email,
  u.display_name
order by
  (sum(ua.time_spent_seconds)) desc;

















create table public.unassigned_group_members (
  id uuid not null default extensions.uuid_generate_v4 (),
  group_id uuid not null,
  unassigned_activity_id uuid not null,
  created_at timestamp with time zone null default now(),
  constraint unassigned_group_members_pkey primary key (id),
  constraint unassigned_group_members_unassigned_activity_id_key unique (unassigned_activity_id),
  constraint unassigned_group_members_group_id_fkey foreign KEY (group_id) references unassigned_work_groups (id) on delete CASCADE,
  constraint unassigned_group_members_unassigned_activity_id_fkey foreign KEY (unassigned_activity_id) references unassigned_activity (id) on delete CASCADE
) TABLESPACE pg_default;


create index IF not exists idx_unassigned_group_members_group_id on public.unassigned_group_members using btree (group_id) TABLESPACE pg_default;


create index IF not exists idx_unassigned_group_members_activity_id on public.unassigned_group_members using btree (unassigned_activity_id) TABLESPACE pg_default;























create table public.unassigned_work_groups (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  group_label text not null,
  group_description text null,
  confidence_level text null,
  recommended_action text null,
  suggested_issue_key text null,
  recommendation_reason text null,
  session_count integer not null default 0,
  total_seconds integer not null default 0,
  is_assigned boolean null default false,
  assigned_to_issue_key text null,
  assigned_at timestamp with time zone null,
  assigned_by uuid null,
  clustering_metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint unassigned_work_groups_pkey primary key (id),
  constraint unassigned_work_groups_assigned_by_fkey foreign KEY (assigned_by) references users (id),
  constraint unassigned_work_groups_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint unassigned_work_groups_confidence_level_check check (
    (
      confidence_level = any (array['high'::text, 'medium'::text, 'low'::text])
    )
  ),
  constraint unassigned_work_groups_recommended_action_check check (
    (
      recommended_action = any (
        array[
          'assign_to_existing'::text,
          'create_new_issue'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;


create index IF not exists idx_unassigned_groups_user_id on public.unassigned_work_groups using btree (user_id) TABLESPACE pg_default;


create index IF not exists idx_unassigned_groups_is_assigned on public.unassigned_work_groups using btree (is_assigned) TABLESPACE pg_default;


create index IF not exists idx_unassigned_groups_created_at on public.unassigned_work_groups using btree (created_at desc) TABLESPACE pg_default;


create trigger trigger_update_unassigned_groups_updated_at BEFORE
update on unassigned_work_groups for EACH row
execute FUNCTION update_unassigned_groups_updated_at ();































create table public.user_jira_issues_cache (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  issue_key text not null,
  summary text not null,
  status text not null,
  project_key text not null,
  issue_type text null,
  updated_at timestamp with time zone null default now(),
  cached_at timestamp with time zone null default now(),
  constraint user_jira_issues_cache_pkey primary key (id),
  constraint user_jira_issues_cache_user_id_issue_key_key unique (user_id, issue_key),
  constraint user_jira_issues_cache_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;


create index IF not exists idx_user_jira_cache_user_id on public.user_jira_issues_cache using btree (user_id) TABLESPACE pg_default;


create index IF not exists idx_user_jira_cache_issue_key on public.user_jira_issues_cache using btree (issue_key) TABLESPACE pg_default;


create index IF not exists idx_user_jira_cache_user_updated on public.user_jira_issues_cache using btree (user_id, updated_at desc) TABLESPACE pg_default;


create index IF not exists idx_user_jira_cache_status on public.user_jira_issues_cache using btree (status) TABLESPACE pg_default;


create index IF not exists idx_user_jira_cache_cached_at on public.user_jira_issues_cache using btree (cached_at) TABLESPACE pg_default;


create trigger update_user_jira_cache_cached_at BEFORE INSERT
or
update on user_jira_issues_cache for EACH row
execute FUNCTION update_cached_at_column ();





create table public.users (
  id uuid not null default extensions.uuid_generate_v4 (),
  atlassian_account_id text not null,
  email text null,
  display_name text null,
  supabase_user_id uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  last_sync_at timestamp with time zone null,
  is_active boolean null default true,
  settings jsonb null default '{}'::jsonb,
  constraint users_pkey primary key (id),
  constraint users_atlassian_account_id_key unique (atlassian_account_id),
  constraint users_supabase_user_id_fkey foreign KEY (supabase_user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;


create index IF not exists idx_users_atlassian_account_id on public.users using btree (atlassian_account_id) TABLESPACE pg_default;


create index IF not exists idx_users_supabase_user_id on public.users using btree (supabase_user_id) TABLESPACE pg_default;


create trigger update_users_updated_at BEFORE
update on users for EACH row
execute FUNCTION update_updated_at_column ();

















create view public.weekly_time_summary as
select
  ar.user_id,
  u.display_name as user_display_name,
  date_trunc('week'::text, s."timestamp")::date as week_start,
  ar.active_project_key,
  ar.active_task_key,
  count(distinct s.id) as screenshot_count,
  sum(ar.time_spent_seconds) as total_seconds,
  round(sum(ar.time_spent_seconds)::numeric / 3600.0, 2) as total_hours,
  avg(ar.confidence_score) as avg_confidence
from
  analysis_results ar
  join screenshots s on s.id = ar.screenshot_id
  left join users u on u.id = ar.user_id
where
  ar.work_type = 'office'::text
group by
  ar.user_id,
  u.display_name,
  (date_trunc('week'::text, s."timestamp")),
  ar.active_project_key,
  ar.active_task_key
order by
  (date_trunc('week'::text, s."timestamp")::date) desc,
  ar.user_id,
  ar.active_project_key,
  ar.active_task_key;















create table public.worklogs (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  analysis_result_id uuid null,
  jira_worklog_id text not null,
  jira_issue_key text not null,
  time_spent_seconds integer not null,
  started_at timestamp with time zone not null,
  description text null,
  created_at timestamp with time zone null default now(),
  sync_status text null default 'synced'::text,
  error_message text null,
  constraint worklogs_pkey primary key (id),
  constraint worklogs_analysis_result_id_fkey foreign KEY (analysis_result_id) references analysis_results (id) on delete set null,
  constraint worklogs_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint worklogs_sync_status_check check (
    (
      sync_status = any (
        array['synced'::text, 'pending'::text, 'failed'::text]
      )
    )
  )
) TABLESPACE pg_default;


create index IF not exists idx_worklogs_user_id on public.worklogs using btree (user_id) TABLESPACE pg_default;


create index IF not exists idx_worklogs_issue_key on public.worklogs using btree (jira_issue_key) TABLESPACE pg_default;


create index IF not exists idx_worklogs_started_at on public.worklogs using btree (started_at desc) TABLESPACE pg_default;


create index IF not exists idx_worklogs_jira_worklog_id on public.worklogs using btree (jira_worklog_id) TABLESPACE pg_default;

