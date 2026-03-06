import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Target, Plus, Edit2, Trash2, CheckCircle2, TrendingUp, ChevronRight, ChevronLeft, History, ListTodo, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Biomarker } from '../../utils/mockData';
import { HealthGoal, fetchGoals, createGoal, updateGoal, deleteGoal, createNotification } from '../../utils/supabase';
import { GoalCelebration } from './GoalCelebration';

// Re-export HealthGoal for backward compatibility
export type { HealthGoal } from '../../utils/supabase';

interface GoalsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  biomarkers: Biomarker[];
}

const SMART_STEPS = [
  { key: 'specific', label: 'Specific', description: 'What exactly do you want to achieve?' },
  { key: 'measurable', label: 'Measurable', description: 'How will you measure progress?' },
  { key: 'achievable', label: 'Achievable', description: 'Is this goal realistic for you?' },
  { key: 'relevant', label: 'Relevant', description: 'Why does this goal matter to you?' },
  { key: 'timeBound', label: 'Time-bound', description: 'When do you want to achieve this?' },
] as const;

export function GoalsManager({ isOpen, onClose, userId, biomarkers }: GoalsManagerProps) {
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<HealthGoal | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [wizardStep, setWizardStep] = useState(0);
  const [newGoal, setNewGoal] = useState({
    type: 'steps' as HealthGoal['type'],
    target: 10000,
    targetSystolic: 120,
    targetDiastolic: 80,
    period: 'daily' as HealthGoal['period'],
    deadline: '',
    smartSpecific: '',
    smartMeasurable: '',
    smartAchievable: '',
    smartRelevant: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadGoals();
    }
  }, [userId, isOpen]);

  // Track which goals have already been notified to avoid duplicates
  const [notifiedGoals, setNotifiedGoals] = useState<Set<string>>(new Set());
  const [celebratingGoalLabel, setCelebratingGoalLabel] = useState<string | null>(null);

  // Check if any goal just hit 100% and fire a GOAL notification
  useEffect(() => {
    if (goals.length === 0 || biomarkers.length === 0) return;

    goals.forEach(goal => {
      if (goal.status === 'completed' || notifiedGoals.has(goal.id)) return;
      const progress = getGoalProgress(goal);
      if (progress >= 100) {
        const label = getGoalTypeLabel(goal.type);
        createNotification(
          userId,
          'GOAL',
          `🎯 Goal Completed: ${label} - You reached your target of ${getGoalTargetText(goal)}!`
        ).catch(console.error);
        toast.success(`🎯 Goal completed: ${label}!`);
        setCelebratingGoalLabel(label);
        setNotifiedGoals(prev => new Set(prev).add(goal.id));
      }
    });
  }, [goals, biomarkers]);

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
        smartSpecific: newGoal.smartSpecific || undefined,
        smartMeasurable: newGoal.smartMeasurable || undefined,
        smartAchievable: newGoal.smartAchievable || undefined,
        smartRelevant: newGoal.smartRelevant || undefined,
      };

      const createdGoal = await createGoal(goal);
      
      if (createdGoal) {
        setGoals([createdGoal, ...goals]);
        setShowAddGoal(false);
        setWizardStep(0);
        setNewGoal({
          type: 'steps',
          target: 10000,
          targetSystolic: 120,
          targetDiastolic: 80,
          period: 'daily',
          deadline: '',
          smartSpecific: '',
          smartMeasurable: '',
          smartAchievable: '',
          smartRelevant: '',
        });
        toast.success('SMART Goal created successfully!');
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

  const activeGoals = goals.filter(g => g.status !== 'completed' && g.status !== 'expired');
  const pastGoals = goals.filter(g => g.status === 'completed' || g.status === 'expired');

  const renderWizardStep = () => {
    const step = SMART_STEPS[wizardStep];
    
    switch (wizardStep) {
      case 0: // Specific - What goal type?
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Badge variant="outline" className="mb-2 text-lg px-4 py-1">S</Badge>
              <h3 className="text-lg font-semibold">{step.label}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
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
              <Label>Describe your specific goal</Label>
              <Textarea
                placeholder={`e.g., "Walk 10,000 steps every day to improve cardiovascular health"`}
                value={newGoal.smartSpecific}
                onChange={(e) => setNewGoal({ ...newGoal, smartSpecific: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        );

      case 1: // Measurable - Target values
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Badge variant="outline" className="mb-2 text-lg px-4 py-1">M</Badge>
              <h3 className="text-lg font-semibold">{step.label}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
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
            <div>
              <Label>How will you track progress?</Label>
              <Textarea
                placeholder={`e.g., "Track step count daily via my smartwatch"`}
                value={newGoal.smartMeasurable}
                onChange={(e) => setNewGoal({ ...newGoal, smartMeasurable: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
        );

      case 2: // Achievable
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Badge variant="outline" className="mb-2 text-lg px-4 py-1">A</Badge>
              <h3 className="text-lg font-semibold">{step.label}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
            <div>
              <Label>What makes this goal achievable for you?</Label>
              <Textarea
                placeholder={`e.g., "I currently walk 6,000 steps. Increasing to 10,000 is a stretch but doable with lunchtime walks."`}
                value={newGoal.smartAchievable}
                onChange={(e) => setNewGoal({ ...newGoal, smartAchievable: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>
            <Card className="p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">
                <strong>Tip:</strong> Consider your current baseline, available resources, and any constraints before setting your target.
              </p>
            </Card>
          </div>
        );

      case 3: // Relevant
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Badge variant="outline" className="mb-2 text-lg px-4 py-1">R</Badge>
              <h3 className="text-lg font-semibold">{step.label}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
            <div>
              <Label>Why is this goal important to your health?</Label>
              <Textarea
                placeholder={`e.g., "Improving my daily activity will help manage my blood pressure and reduce cardiovascular risk."`}
                value={newGoal.smartRelevant}
                onChange={(e) => setNewGoal({ ...newGoal, smartRelevant: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        );

      case 4: // Time-bound
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Badge variant="outline" className="mb-2 text-lg px-4 py-1">T</Badge>
              <h3 className="text-lg font-semibold">{step.label}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
            <div>
              <Label>Deadline</Label>
              <Input
                type="date"
                value={newGoal.deadline}
                onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                className="mt-1 dark:text-gray-700"
              />
            </div>
            <Card className="p-4 bg-muted/50 space-y-2">
              <h4 className="font-medium text-sm">Goal Summary</h4>
              <p className="text-sm"><strong>Type:</strong> {getGoalTypeLabel(newGoal.type)}</p>
              <p className="text-sm"><strong>Target:</strong> {newGoal.type === 'bloodPressure' ? `${newGoal.targetSystolic}/${newGoal.targetDiastolic} mmHg` : newGoal.target}</p>
              <p className="text-sm"><strong>Period:</strong> {newGoal.period}</p>
              {newGoal.smartSpecific && <p className="text-sm"><strong>Specific:</strong> {newGoal.smartSpecific}</p>}
              {newGoal.deadline && <p className="text-sm"><strong>Deadline:</strong> {new Date(newGoal.deadline).toLocaleDateString()}</p>}
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Health Goals
          </DialogTitle>
          <DialogDescription>Set and track your health and fitness goals using the SMART framework</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={activeTab === 'active' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('active')}
          >
            <ListTodo className="w-4 h-4 mr-2" />
            Active Goals ({activeGoals.length})
          </Button>
          <Button
            variant={activeTab === 'past' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('past')}
          >
            <History className="w-4 h-4 mr-2" />
            Past Goals ({pastGoals.length})
          </Button>
        </div>

        <div className="flex-1 overflow-auto pr-2">
          {activeTab === 'active' ? (
            <>
              {loading && goals.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
                  <p className="text-muted-foreground">Loading goals...</p>
                </div>
              ) : activeGoals.length === 0 && !showAddGoal ? (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="mb-2">No Active Goals</h3>
                  <p className="text-muted-foreground mb-6">Set your first SMART health goal to get started</p>
                  <Button onClick={() => { setShowAddGoal(true); setWizardStep(0); }} disabled={loading}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create SMART Goal
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {!showAddGoal && !editingGoal && (
                    <Button onClick={() => { setShowAddGoal(true); setWizardStep(0); }} className="w-full" disabled={loading}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create SMART Goal
                    </Button>
                  )}

                  {showAddGoal && (
                    <Card className="p-6 border-2 border-primary">
                      {/* SMART Step Indicators */}
                      <div className="flex items-center justify-center gap-1 mb-6">
                        {SMART_STEPS.map((s, i) => (
                          <div key={s.key} className="flex items-center">
                            <button
                              onClick={() => setWizardStep(i)}
                              className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                                i === wizardStep
                                  ? 'bg-primary text-primary-foreground'
                                  : i < wizardStep
                                  ? 'bg-green-500 text-white'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {i < wizardStep ? '✓' : s.label[0]}
                            </button>
                            {i < SMART_STEPS.length - 1 && (
                              <div className={`w-6 h-0.5 ${i < wizardStep ? 'bg-green-500' : 'bg-muted'}`} />
                            )}
                          </div>
                        ))}
                      </div>

                      {renderWizardStep()}

                      <div className="flex gap-2 mt-6">
                        {wizardStep > 0 && (
                          <Button variant="outline" onClick={() => setWizardStep(wizardStep - 1)}>
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Back
                          </Button>
                        )}
                        <div className="flex-1" />
                        {wizardStep < SMART_STEPS.length - 1 ? (
                          <Button onClick={() => setWizardStep(wizardStep + 1)}>
                            Next
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        ) : (
                          <Button onClick={handleAddGoal} disabled={loading}>
                            {loading ? 'Creating...' : 'Create Goal'}
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => { setShowAddGoal(false); setWizardStep(0); }} disabled={loading}>Cancel</Button>
                      </div>
                    </Card>
                  )}

              {activeGoals.map((goal) => {
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
            </>
          ) : (
            /* Past Goals Tab */
            <div className="space-y-4">
              {pastGoals.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="mb-2">No Past Goals</h3>
                  <p className="text-muted-foreground">Completed and expired goals will appear here</p>
                </div>
              ) : (
                pastGoals.map((goal) => (
                  <Card key={goal.id} className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4>{getGoalTypeLabel(goal.type)}</h4>
                          <Badge variant={goal.status === 'completed' ? 'default' : 'secondary'}
                            className={goal.status === 'completed' ? 'bg-green-500' : ''}
                          >
                            {goal.status === 'completed' ? 'Completed' : 'Expired'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">
                          {goal.period} Target: {getGoalTargetText(goal)}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)} disabled={loading}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Final Progress</span>
                        <span className="font-semibold">{goal.finalProgress ?? getGoalProgress(goal)}%</span>
                      </div>
                      <Progress value={goal.finalProgress ?? getGoalProgress(goal)} className="h-2" />
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Created: {new Date(goal.createdAt).toLocaleDateString()}</span>
                        </div>
                        {goal.deadline && (
                          <span>Deadline: {new Date(goal.deadline).toLocaleDateString()}</span>
                        )}
                        {goal.completedAt && (
                          <span>Completed: {new Date(goal.completedAt).toLocaleDateString()}</span>
                        )}
                      </div>

                      {goal.status === 'completed' && (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Goal Achieved!</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Goal completion celebration */}
    <GoalCelebration
      goalLabel={celebratingGoalLabel}
      onDismiss={() => setCelebratingGoalLabel(null)}
    />
    </>
  );
}
