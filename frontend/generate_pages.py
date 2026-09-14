import os

pages = {
    "src/pages/user/MyTagging.tsx": ("My Tagging", "Review your cloud resources and assign tags.", "Tag", "No resources assigned to you", "There are no cloud resources currently awaiting your tagging review."),
    "src/pages/user/SavedTags.tsx": ("Saved Tags", "Your saved tagging work that hasn't been submitted.", "Save", "No saved work", "You haven't saved any tagging progress yet."),
    "src/pages/user/Pending.tsx": ("Pending Approval", "Tags you've submitted that are awaiting administrator approval.", "Clock", "No pending approvals", "You have no tagging submissions awaiting approval."),
    "src/pages/user/Approved.tsx": ("Approved", "Tags that have been approved by administrators.", "CheckCircle", "No approved tags", "None of your recent submissions have been approved yet."),
    "src/pages/admin/AdminSavedTags.tsx": ("Saved Work", "All saved tagging work across all users.", "Save", "No saved work found", "No users have saved any tagging progress."),
    "src/pages/admin/AssignedTags.tsx": ("Assigned Tags", "Review and approve submitted tagging batches.", "ShieldCheck", "No pending assignments", "There are currently no tagging batches awaiting your approval."),
    "src/pages/admin/TaggingProgress.tsx": ("Tagging Progress", "Track the progress of tag assignments across the organization.", "Activity", "No progress data available", "Progress metrics will appear once resources are imported and tagging begins."),
    "src/pages/user/Jobs.tsx": ("Jobs", "Track the status of your background jobs and scripts.", "Terminal", "No jobs found", "You have no active or historical jobs."),
    "src/pages/admin/ScriptGeneration.tsx": ("Script Jobs", "Manage platform-wide script generation and execution jobs.", "Terminal", "No scripts generated", "Script generation jobs will appear here once approved tags are processed."),
    "src/pages/admin/AuditLogs.tsx": ("Audit Logs", "System-wide audit trail of all platform activities.", "History", "No audit logs available", "Audit logs will populate as users perform actions in the platform."),
    "src/pages/user/Azure.tsx": ("Azure Resources", "Browse your Azure resource inventory.", "Cloud", "No Azure resources available", "No Azure resources have been imported or assigned to you yet."),
    "src/pages/user/AWS.tsx": ("AWS Resources", "Browse your AWS resource inventory.", "Server", "No AWS resources available", "No AWS resources have been imported or assigned to you yet.")
}

template = """import {{ {icon} }} from "lucide-react";
import {{ Card, CardContent }} from "../../components/ui/Card";
import {{ EmptyState }} from "../../components/ui/EmptyState";

export default function {component_name}() {{
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <EmptyState 
            icon={{<{icon} size={{48}} />}}
            title="{empty_title}"
            description="{empty_desc}"
            className="border-0 bg-transparent py-24"
          />
        </CardContent>
      </Card>
    </div>
  );
}}
"""

for path, data in pages.items():
    title, subtitle, icon, empty_title, empty_desc = data
    component_name = path.split("/")[-1].replace(".tsx", "")
    content = template.format(
        icon=icon,
        component_name=component_name,
        title=title,
        subtitle=subtitle,
        empty_title=empty_title,
        empty_desc=empty_desc
    )
    with open(path, "w") as f:
        f.write(content)

print("Generated pages successfully.")
