import { useState, useEffect } from "react";
import { Activity } from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { useAuth } from "../../contexts/AuthContext";
import { taskAssignmentsApi } from "../../services/api/taskAssignments";

export default function MyTaggingProgress() {
  const { user, getToken } = useAuth();
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const data = await taskAssignmentsApi.getMyTaggingProgress(token);
          setProgress(data);
        }
      } catch (err) {
        console.error("Failed to load progress", err);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) {
      fetchProgress();
    }
  }, [user]);

  if (loading || !progress) {
    return <div className="p-8">Loading progress...</div>;
  }

  const tasks = progress.tasks || [];
  const totalAssignedResources = tasks.reduce((acc: number, t: any) => acc + (t.resource_count || 0), 0);
  // Force 0 completion until backend linkage is available
  const totalCompletedResources = 0; 
  const totalPendingResources = totalAssignedResources;
  const overallProgress = 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Tagging Progress</h1>
          <p className="text-sm text-gray-500 mt-1">Track the progress of your assigned tagging work.</p>
        </div>
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-700">
                  <span className="font-bold">Notice:</span> Real-time progress tracking is temporarily disabled while we upgrade our tagging linkage. Your assignments are saved, but completion metrics will show 0%.
                </p>
              </div>
            </div>
          </div>
          {/* Overall Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 w-full">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Overall Assigned Work</h2>
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-bold text-gray-900">
                  {totalCompletedResources} <span className="text-xl text-gray-400 font-normal">/ {totalAssignedResources} Resources Completed</span>
                </span>
                <span className="text-xl font-bold text-azure">{overallProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                <div className="bg-azure h-3 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }}></div>
              </div>
              <p className="text-sm text-gray-500 font-medium">{totalPendingResources} Pending</p>
            </div>
          </div>

          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-8 mb-4">Task-Level Progress</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map((t: any) => {
              // Force 0 for now
              const comp = 0;
              const total = t.resource_count || 0;
              const pct = 0;
              
              return (
                <Card key={t.id} className="shadow-sm border-gray-200">
                  <CardContent className="p-5 flex flex-col h-full justify-between">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-900">{t.task_number}</h4>
                        <p className="text-sm text-gray-500 line-clamp-1">{t.provider} / {t.scope_type?.replace('_', ' ')} {t.scope_identifier ? `/ ${t.scope_identifier}` : ''}</p>
                      </div>
                      <span className="text-lg font-bold text-azure">{pct}%</span>
                    </div>
                    
                    <div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                        <div className="bg-azure h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{comp} / {total} Resources</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-0">
            <EmptyState 
              icon={<Activity size={48} className="text-azure/40" />}
              title="No assigned tagging tasks to track."
              description="Progress metrics will appear here once you are assigned tagging work."
              className="border-0 bg-transparent py-24"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
