import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Target, Plus, Edit2, Trash2, CheckCircle2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Biomarker } from '../../utils/mockData';
import { HealthGoal, fetchGoals, createGoal, updateGoal, deleteGoal } from '../../utils/supabase';

// Re-export HealthGoal for backward compatibility
export type { HealthGoal } from '../../utils/supabase';

interface GoalsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  biomarkers: Biomarker[];
}

export function GoalsManager({ isOpen, onClose, userId, biomarkers }: GoalsManagerProps) {
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<HealthGoal | null>(null);
  const [loading, setLoading] = useState(false);
  const [newGoal, setNewGoal] = useState({
    type: 'steps' as HealthGoal['type'],
    target: 10000,
    targetSystolic: 120,
    targetDiastolic: 80,
    period: 'daily' as HealthGoal['period'],
    deadline: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadGoals();
    }
  }, [userId, isOpen]);

  const loadGoals = async () => {
    setLoading(true);
    try {
      const fetchedGoals = await fetchGoals(userId);
      setGoals(fetchedGoals);
    } catch (error) {
      console.error('Error loading goals:', error);
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async () => {
    setLoading(true);
    try {
      const goal: Omit<HealthGoal, 'id' | 'createdAt'> = {
        userId,
        type: newGoal.type,
        target: newGoal.type === 'bloodPressure' ? 0 : newGoal.target,
        targetSystolic: newGoal.type === 'bloodPressure' ? newGoal.targetSystolic : undefined,
        targetDiastolic: newGoal.type === 'bloodPressure' ? newGoal.targetDiastolic : undefined,
        period: newGoal.period,
        deadline: newGoal.deadline || undefined,
      };

      const createdGoal = await createGoal(goal);
      
      if (createdGoal) {
        setGoals([createdGoal, ...goals]);
        setShowAddGoal(false);
        setNewGoal({
          type: 'steps',
          target: 10000,
          targetSystolic: 120,
          targetDiastolic: 80,
          period: 'daily',
          deadline: '',
        });
        toast.success('Goal created successfully!');
      } else {
        toast.error('Failed to create goal. Only steps, sleep, and weight goals are currently supported.');
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      toast.error('Failed to create goal');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGoal = async () => {
    if (!editingGoal) return;

    setLoading(true);
    try {
      const success = await updateGoal(editingGoal.id, {
        target: editingGoal.target,
        period: editingGoal.period,
        deadline: editingGoal.deadline
      });

      if (success) {
        await loadGoals();
        setEditingGoal(null);
        toast.success('Goal updated successfully!');
      } else {
        toast.error('Failed to update goal');
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      toast.error('Failed to update goal');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setLoading(true);
    try {
      const success = await deleteGoal(goalId);
      
      if (success) {
        setGoals(goals.filter(g => g.id !== goalId));
        toast.success('Goal deleted successfully!');
      } else {
        toast.error('Failed to delete goal');
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast.error('Failed to delete goal');
    } finally {
      setLoading(false);
    }
  };

  const getGoalProgress = (goal: HealthGoal) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let filterDate = startOfDay;
    if (goal.period === 'weekly') filterDate = startOfWeek;
    if (goal.period === 'monthly') filterDate = startOfMonth;

    const relevantData = biomarkers.filter(
      b => b.type === goal.type && new Date(b.timestamp) >= filterDate
    );

    if (relevantData.length === 0) return 0;

    if (goal.type === 'bloodPressure') {
      const avgSystolic = relevantData.reduce((sum, b) => sum + (b.systolic || 0), 0) / relevantData.length;
      const avgDiastolic = relevantData.reduce((sum, b) => sum + (b.diastolic || 0), 0) / relevantData.length;
      const systolicProgress = Math.min((avgSystolic / (goal.targetSystolic || 120)) * 100, 100);
      const diastolicProgress = Math.min((avgDiastolic / (goal.targetDiastolic || 80)) * 100, 100);
      return Math.round((systolicProgress + diastolicProgress) / 2);
    }

    // For steps, sum all values in the period
    // For weight and other metrics, use average
    const current = goal.type === 'steps' 
      ? relevantData.reduce((sum, b) => sum + b.value, 0)
      : relevantData.reduce((sum, b) => sum + b.value, 0) / relevantData.length;

    // For weight goals, calculate progress based on proximity to target
    if (goal.type === 'weight') {
      // If current is close to or at target, show higher progress
      const difference = Math.abs(current - goal.target);
      const maxDifference = 20; // Maximum reasonable difference in kg
      const progress = Math.max(0, 100 - (difference / maxDifference) * 100);
      return Math.min(Math.round(progress), 100);
    }

    return Math.min(Math.round((current / goal.target) * 100), 100);
  };

  const getGoalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      steps: 'Daily Steps',
      heartRate: 'Heart Rate',
      bloodPressure: 'Blood Pressure',
      glucose: 'Blood Glucose',
      sleep: 'Sleep Hours',
      weight: 'Weight',
    };
    return labels[type] || type;
  };

  const getGoalTargetText = (goal: HealthGoal) => {
    if (goal.type === 'bloodPressure') {
      return `${goal.targetSystolic}/${goal.targetDiastolic} mmHg`;
    }
    const units: Record<string, string> = {
      steps: 'steps',
      heartRate: 'bpm',
      glucose: 'mg/dL',
      sleep: 'hours',
      weight: 'kg',
    };
    return `${goal.target} ${units[goal.type] || ''}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Health Goals
          </DialogTitle>
          <DialogDescription>Set and track your health and fitness goals</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto pr-2">
          {loading && goals.length === 0 ? (
            <div className="text-center py-12">
              <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
              <p className="text-muted-foreground">Loading goals...</p>
            </div>
          ) : goals.length === 0 && !showAddGoal ? (
            <div className="text-center py-12">
              <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="mb-2">No Goals Yet</h3>
              <p className="text-muted-foreground mb-6">Set your first health goal to get started</p>
              <Button onClick={() => setShowAddGoal(true)} disabled={loading}>
                <Plus className="w-4 h-4 mr-2" />
                Create Goal
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {!showAddGoal && !editingGoal && (
                <Button onClick={() => setShowAddGoal(true)} className="w-full" disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Goal
                </Button>
              )}

              {showAddGoal && (
                <Card className="p-6 border-2 border-primary">
                  <h3 className="text-foreground mb-4">Create New Goal</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Goal Type</Label>
                        <Select value={newGoal.type} onValueChange={(value: any) => setNewGoal({ ...newGoal, type: value })}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="steps">Daily Steps</SelectItem>
                            <SelectItem value="heartRate">Heart Rate</SelectItem>
                            <SelectItem value="bloodPressure">Blood Pressure</SelectItem>
                            <SelectItem value="glucose">Blood Glucose</SelectItem>
                            <SelectItem value="sleep">Sleep Hours</SelectItem>
                            <SelectItem value="weight">Weight</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Period</Label>
                        <Select value={newGoal.period} onValueChange={(value: any) => setNewGoal({ ...newGoal, period: value })}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {newGoal.type === 'bloodPressure' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Target Systolic</Label>
                          <Input
                            type="number"
                            value={newGoal.targetSystolic}
                            onChange={(e) => setNewGoal({ ...newGoal, targetSystolic: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Target Diastolic</Label>
                          <Input
                            type="number"
                            value={newGoal.targetDiastolic}
                            onChange={(e) => setNewGoal({ ...newGoal, targetDiastolic: parseInt(e.target.value) })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label>Target Value</Label>
                        <Input
                          type="number"
                          value={newGoal.target}
                          onChange={(e) => setNewGoal({ ...newGoal, target: parseInt(e.target.value) })}
                          className="mt-1"
                        />
                      </div>
                    )}

                    <div>
                      <Label>Deadline (Optional)</Label>
                      <Input
                        type="date"
                        value={newGoal.deadline}
                        onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                        className="mt-1 dark:text-gray-700"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleAddGoal} className="flex-1" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Goal'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowAddGoal(false)} disabled={loading}>Cancel</Button>
                    </div>
                  </div>
                </Card>
              )}

              {goals.map((goal) => {
                const progress = getGoalProgress(goal);
                const isEditing = editingGoal?.id === goal.id;

                return (
                  <Card key={goal.id} className="p-6">
                    {isEditing ? (
                      <div className="space-y-4">
                        <h3>Edit Goal</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Period</Label>
                            <Select value={editingGoal.period} onValueChange={(value: any) => setEditingGoal({ ...editingGoal, period: value })}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Target Value</Label>
                            <Input
                              type="number"
                              value={editingGoal.target}
                              onChange={(e) => setEditingGoal({ ...editingGoal, target: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleUpdateGoal} className="flex-1" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button variant="outline" onClick={() => setEditingGoal(null)} disabled={loading}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4>{getGoalTypeLabel(goal.type)}</h4>
                            <p className="text-sm text-muted-foreground capitalize">
                              {goal.period} Target: {getGoalTargetText(goal)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setEditingGoal(goal)} disabled={loading}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)} disabled={loading}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-semibold">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                          {progress >= 100 && (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Goal Achieved!</span>
                            </div>
                          )}
                          {goal.deadline && (
                            <p className="text-xs text-muted-foreground">
                              Deadline: {new Date(goal.deadline).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
