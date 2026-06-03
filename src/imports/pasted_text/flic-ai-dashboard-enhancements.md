CONTINUE ENHANCING THE CURRENT FLIC AI OPERATIONS DASHBOARD

Do NOT redesign the entire system.
Only apply the changes listed below to the existing prototype.

====================================================

1. STICKY FILTER PANEL
   ====================================================

Apply to all screens.

The Filter Panel must:

* Stay fixed while scrolling
* Always remain visible at the top of the content area
* Never disappear when users scroll
* Behave similarly to Power BI / Tableau filters

Apply to:

* Operations Overview
* Multi-Channel Analytics
* Keyword Analytics
* FAQ Management
* Conversation Center
* AI QA & Insights
* Sentiment Analysis
* Dashboard Builder

====================================================
2. LOGIN SYSTEM
===============

Create a complete login experience.

Features:

* Remember Me
* Save user credentials locally
* Auto-login on next visit

Fields:

* Username
* Password
* Passcode

Checkbox:

* Remember Me

Button:

* Sign In

====================================================
3. ACCOUNT SECURITY
===================

Remove self-service password reset.

Instead, when users click:

"Forgot Password"

Display:

"Please contact your system administrator to reset your password."

====================================================
4. PASSCODE CONFIRMATION
========================

Inside:

"Personal Settings"

Whenever users:

* Change password
* Change email
* Change phone number
* Save profile changes

The system must:

Step 1:
User clicks Save

Step 2:
Open modal:

"Passcode Verification"

Fields:

* Enter Passcode

Buttons:

* Confirm
* Cancel

Changes are saved only after successful passcode verification.

====================================================
5. SIDEBAR
==========

Sidebar text color:

#EBF2FF

Logo:

* Place inside a white rounded container
* White background behind the logo
* Match the overall design system

====================================================
6. OPERATIONAL METRICS
======================

Rename:

"Processing Volume"

to:

"Number of Conversations"

Apply consistently across the system.

====================================================
7. CONVERSATION COUNT KPI
=========================

Add KPI:

"Processed Conversations"

Allow reporting by:

* Day
* Week
* Month

====================================================
8. RESPONSE TIME
================

Response Time must be displayed as:

Average Minutes

Examples:

* 5 minutes
* 12 minutes
* 18 minutes

Do NOT use:

* min
* mins
* m

Always display the full word:

"minutes"

====================================================
9. TIMEZONE STANDARDIZATION
===========================

Entire system must use:

Vietnam Time (GMT+7)

Display format:

00:00 → 23:59

====================================================
10. DATE FILTER LOGIC
=====================

When a user selects a specific day:

Example:

28/05/2026

The system must query data between:

00:00:00
to
23:59:59

Only data within that day should be included.

====================================================
11. MONTHLY PERFORMANCE CHECK
=============================

Review all KPI logic.

When filtering by month:

All components must update correctly:

* KPIs
* Charts
* Heatmaps
* Tables

====================================================
12. RECENT ACTIVITY
===================

Remove:

"New Request Received"

from the Recent Activity section.

Only display meaningful operational activities.

====================================================
13. FAQ MODULE
==============

Do NOT add filters to the Chatbot Sheet.

Add the following filters ONLY inside the FAQ Module:

* Topic
* Risk Level
* FAQ Status
* Time Period

====================================================
14. RISK LEVEL DROPDOWN
=======================

Inside the FAQ Module:

Add dropdown:

"Risk Level"

Options:

* High
* Medium
* Low

====================================================
15. SOURCE OF ISSUE DROPDOWN
============================

Inside the FAQ Module:

Add dropdown:

"Source"

Options:

* Incorrect AI Response
* AI Uncertain Response
* Missing Knowledge Base Data
* Hallucination
* Staff Suggestion
* Customer Feedback

====================================================
16. TOPIC SEPARATION
====================

Data must be grouped clearly by topic.

Language Programs:

* TOEIC
* VSTEP
* Graduation Requirement

Computer Programs:

* MOS
* IC3
* Basic Informatics

Do not merge these categories together.

====================================================
17. NOTIFICATION CENTER
=======================

Redesign Notification Center.

Features:

* Group notifications by date
* Checklist style layout
* Completed / Pending status

When users click a notification:

Navigate directly to:

* Conversation
* FAQ
* AI Review
* SLA Warning

related to that notification.

====================================================
18. ICON STANDARDIZATION
========================

Standardize icon colors across the system.

Avoid:

* Random icon colors
* Confusing color meanings

Rules:

Text:

* Navy #003865

Numeric values:

* Orange #D73C01

Tasks:

* Orange

Informational content:

* Navy

Positive/negative indicators:

* May use separate colors where appropriate

====================================================
19. ICON REVIEW
===============

Review all icons and ensure they match their purpose.

Examples:

FAQ
→ Q&A icon

AI
→ AI icon

Performance
→ Analytics icon

Conversation
→ Chat icon

====================================================
20. CHART COLORS
================

Management and Analytics screens must use only:

* Navy #003865
* Orange #D73C01

Do not use random chart color palettes.

====================================================
21. GREEN COLOR UPDATE
======================

Replace all bright lime green colors.

Use:

#228A61

across the entire system.

====================================================
22. HEATMAP IMPROVEMENTS
========================

Redesign the heatmap.

Use Ocean Blue gradient:

#EBF2FF
→ #B8D8FF
→ #7BB6FF
→ #003865

Add filters:

* Channel
* Topic

====================================================
23. AI CHAT ASSISTANT
=====================

The AI Chat header is not visually prominent enough.

Adjust:

* Increase orange usage
* Orange becomes the primary color
* Navy becomes the secondary color

The AI Chat should feel like:

"The Official FLIC AI Assistant"

====================================================
FINAL OBJECTIVE
===============

After these updates:

* Consistent color system
* Consistent icon system
* Consistent KPI calculations
* Consistent date/time handling
* Consistent UX across all modules

The final product should feel like:

* Enterprise SaaS Platform
* AI-Powered Customer Support Operations Center
* Professional Analytics Dashboard
* Production-Ready Client Demo
