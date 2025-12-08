# BRD Time Tracker - System Architecture Diagrams

This document contains PlantUML diagrams visualizing the system architecture of the BRD Time Tracker application.

## 1. System Architecture Diagram

This diagram shows the high-level architecture with all components, their relationships, and data flows.

![System Architecture](https://www.plantuml.com/plantuml/svg/ZLZVSnCt47w_lsARFX3SiHaAzC4pPN2SGDs6niHEUM4ce-ZMjcgTT9NsOao7_xqZwNxfxWpb9TpgsvLszMa_oMyiCKD59k7YzXBM8aDO6yRtQ60CgwCbp61c-4uGSYeC9Z_G3ZE4N3AX4hiNAcU6PS1rbck5YbPqb0W6EJ6rbTY2IA6GZZc2DhJJhO47nlTRemkLphNK1dvyw_yb2GcI-7yNbkICxzaMuUpEee4hzIYCLXagEeD_4sXM26VB8-sqWakqUz8vpFBy39YjlcTv7iDNt20gkzC4SvQxoJoyCPVMs6l6IJmAEi9xhGHfutqgOscBFMvc1UtWFLDiYm7kBQKXnbPhNnKvUs0MOIw5JxN9enfAlhPgCvUwI66XDePPCWKFsRZwr90wv58oscYJXN60b54OE5jgIrk3gm_NS5aQGqbAryiBxs19cpZaAbWYS6dp7gqChz8jmjj2SH9QMU_XJBMbYxVrTemF-B3JUj_PfO_1slLBDIySIoAloz9umgV8KqOu5jOMQCUSyLr8wSxRv-ux0VYQ07GuiO0LcaSqdzJvdph5oTyMVeAhpxb1Qvy6XYm2uYG5tR3WNGgMrWxFjPH2RIENqZQ8dyl24fgkIsCUz7Bdims_kBqSnDtag6QBDb639HXwjNghpHRTsVoapcSacRM2gPgJeLWUqpkljyWumTt2G_p7tQAp3uh98mdkXgsMZsW2mMfxRJwv3R5ZCt32yqwv1BOAK_YepRxZteoUS5yufdMSlEq4tiqXzRRZKLfF-8I2rqVrZeIqJPNhRXBv_2uCQo7Tf_-AUixLPqAZcAnOOik6x5jH2E7RKXt2VmrCT7krMiDikQY1i-LYg8M-kBwf8TvIaYjC65ZN8c0SujroFNu9VmahjAedUxTSlmoc8V0QFrC4TGPNWYTjZG6XoZfmhHIMNQmH7HYFN_T51QPGMEpXEa9o0jNMZnEGZbXKgCxIIOSjIgA8ph-kCKoXhZvif3uatT0-lxZfk-bogLaAJVksttIyl80f26NH46H8p8cIMsqDhggSz3g_ZnDf24mXPuP0Rv9En_ycjjNclubhhNaoUTsN8fWscaf6R9tA9qyWLZvN-retJYHLYGPCuRVrUWdBczKQb2Qn4PovA2vi7QGfKUqNKwyyfnKN8bIi7uEGdbuCeXgP61nkQqEBb4qIDINZ9Deq-QT0StmMnDfNUXZRS37L1zLZOoVZtYovbX9oLAdJpRPZlmuzNnuWK3JoSD1cdqJPEw-c0JdwPswvp8cL5NOOx7lI5CZzuVL2N0bhOMruKEcezouL4wPWKALE9YgBfrfF8c4AxmpBTn-kVS45nWu3qlWTZm4r_8v7B8NV0NTLS00ULQaXMZzr5o-IHvZ21edlmkuuS39KW26_p7VLY453bHXoxTAdKuyX5tztBUTqVI_fbQNgxbxG7LSDkdDq23YRn15xrAx46ZYJqYPDf2gk6-l18YOsgB1QdQDXGJQxBRY1Xl8NxWqOxkU-fLPN45kUnBO4Dn9MHGglf2cmWdQeg6gYrIHTMBFyH6b2C6AxSm8m-4GSZLgtoBTI7wQZKGBmV58zBW4VqHpX5MH25OJkblRp1Ew2J9A6xcCg0NWnWKKiYGxeNs4l9x0EqWA7-Z7pQj9gfBdH7Atr4_qoSLV6GfBrZpTCGIWN1rNgz0Ix2RPUAwFHR07B44keRSXg3D5roX-ABsWZaZlK9RfdVBYnbPkznsCOc_kx_qQWzTm3znj20d2kDnl1yPdIQXp--xI4-sPdUuV23LOleee6pFfV7uhyP8Qj9yPezBwG9CPhL4pnOvNX5UCxQ6wnxd92J764N-4vQBDbIdm9_77es-kLKmp1NJweDjfm166rR20pAQjE11iX2Tq-F1oZMFSY3U6qnB5ZGmgCkz8xPfFHiflGWoRIcITb-v4-6ls1HrYp1ucsIgWzZuLpSkaI6AqfLDYTBGldKgWzUaPgimqZhMs5yuEWdHkw5saOhGJhtfGKwqEQFRjdrUydVLHKY0op1x-UsulP_6ahxJUeqYAJ_m40)

### Key Components:

1. **User Environment**
   - Python Desktop App: Captures screenshots, monitors activity, handles OAuth
   - Components: Screenshot Capture, Activity Monitor, OAuth Manager, Supabase Client

2. **Cloud Infrastructure**
   - **Supabase Platform**: PostgreSQL database, Storage, Edge Functions
   - **AI Server**: Node.js server for screenshot analysis using GPT-4
   - **Forge App**: Atlassian Forge application with React UI and GraphQL resolvers

3. **External Services**
   - Jira Cloud: REST API and OAuth 3LO
   - OpenAI: GPT-4 Vision and Text APIs

### Data Flow Highlights:

- **Screenshot Flow**: Desktop App → Supabase Storage → Database → Edge Function → AI Server → Analysis Results
- **Multi-Tenancy**: All data isolated by `organization_id`, enforced via RLS policies
- **AI Processing**: GPT-4 Vision analyzes screenshots, detects Jira issue keys, classifies work type
- **Analytics**: Forge App queries Supabase for time tracking analytics filtered by organization

---

## 2. Data Flow Sequence Diagram

This diagram shows the detailed sequence of operations for screenshot processing, from capture to analytics display.

![Data Flow Sequence](https://www.plantuml.com/plantuml/svg/dLPHRzis47xNhxXrGEEWyRfssuk15BNZf7Ctf5xijYy238QysfoaeqPITjnVFv2Y95fsqcv-aIpTyRwxx-uxlJMMQLiLEKpkfh2K1S9ICvwXXY5CcMLmawiTBF2V2ebZyeFTO85GvanIOZ999TEiW7l6ixLM5OahbIiDFzxuNsHXmWbZhTLkkP4y8pG6NaSctfyhJQZXrSz9OgNDyHIk1TU8P3RAmbmhZiP8MdTeauHngpHyDAYJacahkImPMNWsHPDPLSAuB5CQpFTse-Zy6J03uSsuB0yz5bN9xfb1M5YbsHgzSRX_n78wgK-S7Bw_5ck4cugubOfI6fWsYU4ExpTAPJMIp_MVG-Vn31QejwXJ6jmgWJ_zRMhhyQn-VcZ-eKGQpr8Ql9ilXx_29sbaasZzwj3yHkarXgAybvhLblxfKK7SUxZALILWF9zvG_TeF9yboULbJCqLAssb4Px3np9NJC3bPU8eWU6RgDmZ5nTqHIHfxOYJMsOnvgExxNis4RfIfZJ0BUez_0Q5fFCdVAyVh6RSmawIK3lmlPRISs1bcKlE74b0hC3U4O7wKPDJ5nfauNgYpQ1fad25OGz0Sq35NGCd0eyyU-0d8vYHGMtZe0LQ9fXbhg4iivMvF2kHXAJrsNbKpKaodHmXk4Ekj02kaLaKCOBfvE1VnuMZU3oBfswfvNgDsf7hGhnf-dVavz4FXArDKXhCRXVNTql0BPADu3Kj7wvDjXzBuTwsURL1p_gMDsZv1Yg3-im0Pto38YNVgTAO2asJVOlj3csbAPWsHj6XpLYDuFVbSWxp3ujbIYzPALyoOld-Amux3heysc5iJpeugdDPIN7XuRgRb4nD-AfaTdFHe8a8QEeJgZzs48mqhkRDwGUzELKx-X_TsI6TEMDmVNMgB-EOjPoC81OQ9mmf3Nn4U05SaSM7cE-WGVMb5xfDJgEfSZVGbfbibU7-0dPAPokxB_4Y9QxeYnHkewmCLnhFOwGXG0pKjSc2RH5O2B2g0vXJKt82Zc5R54SdDYqQ2L3Jhg5HnDdneRLNV-8IbbjOCfF17xY7ALhapWYW7xJ5b4lAK81LTSyac1k4MzKUSiBtoWyxLCICaMj2iV8GfDs3zdAG88aaoZEUcZOmLqMPeyKuWxRvNPTwdVyaSMTg9okvYVM_sIqZJrMztrl3Zf5s1JKtJHf_LKxaMUEHqk2Bp2rg572_1wNNZEHNB-8hAKuAOOV01pTLKJ0jqRXnRDaq5ssxzCYA0ONzryYGvm84MYRpA9TcIuPh3yJCEqdwedJXSSVn6jSkwF2DB_48fjAKEOjA0OAPpRrY-g2zsa9wSbhouRFI6LpbbR6edPht5ALhsRdASsTWK6ybn_wUFUw2VkC5YUv2XxwJwDXptuvbJPwJHNZXE3n_UZIZD8pR2uhw93qkL4jyi46cU9qz65d8d6alCj-fLQ5mAC3ZDodjfDtuGIeA9E69DDyhJD5CUg6hptow1k-yJH2dHnVuyMYEVIHJytzoBjtmndJrqJmwcdsYlvLC5p8aywqQ7apVqI24G5vCwooTFbu_I6DT__evIm2E4-wCty_kniDNhtz90Fh91Rtlxv10VBEfUewjFWJnTGN9rJe1E9fmWDFoyBbsQR_L04x8WvV_4ECMTq_a6em8Ts5pF0su-vBwBvXhINiIyN61_vIKjULrP7GO_M8wgMblaKHLvFy2)

### Sequence Flow:

1. **Screenshot Capture & Upload**
   - Desktop app captures screenshot every 5 minutes
   - Uploads to Supabase Storage
   - Inserts metadata into database with status='pending'

2. **AI Processing Trigger**
   - Database trigger fires on INSERT
   - Edge Function (screenshot-webhook) is invoked
   - Fetches user's cached Jira issues
   - Notifies AI Server via HTTP POST

3. **AI Analysis**
   - AI Server downloads screenshot from Storage
   - Sends to OpenAI GPT-4 Vision API
   - Receives analysis (task_key, work_type, confidence)
   - Saves results to database
   - Creates unassigned_activity if no task_key detected

4. **User Views Analytics**
   - User opens Forge App in Jira
   - Forge App queries Supabase (filtered by organization_id)
   - Fetches issue details from Jira API
   - Displays analytics dashboard

5. **Unassigned Work Clustering**
   - AI Server polling service runs every 5 minutes
   - Fetches unassigned activities grouped by user + org
   - Uses GPT-4 Text API to cluster similar work
   - Saves groups with recommendations

6. **User Assigns Work**
   - User views unassigned groups in Forge App
   - Can assign to existing issue or create new issue
   - Updates analysis_results and creates worklogs

---

## Architecture Highlights

### Multi-Tenancy Design

- **Tenant Boundary**: Each Jira Cloud instance = 1 organization
- **Data Isolation**: All tables have `organization_id` column
- **RLS Policies**: Row Level Security enforces organization-level isolation
- **RBAC**: Role-based access control via `organization_members` table

### Key Technologies

- **Desktop App**: Python 3.x, Flask, Pillow, Supabase client
- **Backend**: Node.js 20+, Express, Supabase JS client
- **Database**: PostgreSQL 15+ (Supabase), with RLS policies
- **Storage**: Supabase Storage (S3-compatible)
- **AI**: OpenAI GPT-4 Vision and Text APIs
- **Frontend**: React 18, Atlassian Forge UI Kit
- **Platform**: Atlassian Forge (serverless)

### Data Flow Patterns

1. **Event-Driven**: Database triggers → Edge Functions → AI Server
2. **Polling Backup**: AI Server polling service for missed screenshots
3. **Multi-Tenant Queries**: All queries filtered by `organization_id`
4. **Caching**: User's Jira issues cached in `user_jira_issues_cache` table

---

## PlantUML Source Code

The PlantUML source code for these diagrams can be regenerated or modified. The diagrams are hosted on plantuml.com and can be embedded in documentation.

### Regenerating Diagrams

To regenerate or modify these diagrams, use the PlantUML MCP tool or any PlantUML-compatible tool with the source code from the architecture documentation.

---

**Last Updated**: December 2025
**Diagram Format**: SVG (via PlantUML)
