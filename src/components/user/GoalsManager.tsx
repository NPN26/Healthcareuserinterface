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
import {
  validateNumber,
  validateText,
  validateDate,
  validateEnum,
  sanitizeText,
  containsDangerousPatterns,
} from '../../utils/inputValidation';

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
    period: 'daily' as HealthGoal['period'],
    deadline: '',
    smartSpecific: '',
    smartMeasurable: '',
    smartAchievable: '',
    smartRelevant: '',
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadGoals();
    }
  }, [userId, isOpen]);

  // Trigger re-render when biomarkers change to update goal progress in real-time
  useEffect(() => {
    if (isOpen && biomarkers.length > 0) {
      // Force component to recalculate all goal progress by incrementing trigger
      setRefreshTrigger(prev => prev + 1);
    }
  }, [biomarkers, isOpen]);

  // Occasionally refresh goals from database to catch any updates
  useEffect(() => {
    if (!isOpen || goals.length === 0) return;

    // Only refresh periodically if goals list might have changed
    const interval = setInterval(() => {
      loadGoals();
    }, 10000); // Refresh goals every 10 seconds while dialog is open

    return () => clearInterval(interval);
  }, [isOpen, goals.length]);

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
        ).catch(() => {});
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
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async () => {
    // Validate goal type
    const validGoalTypes = ['steps', 'sleep', 'weight'] as const;
    const typeValidation = validateEnum(newGoal.type, validGoalTypes);
    if (!typeValidation.isValid) {
      toast.error('Please select a valid goal type');
      return;
    }

    // Validate period
    const validPeriods = ['daily', 'weekly', 'monthly'] as const;
    const periodValidation = validateEnum(newGoal.period, validPeriods);
    if (!periodValidation.isValid) {
      toast.error('Please select a valid period');
      return;
    }

    // Validate target values based on goal type
    const targetRanges: Record<string, { min: number; max: number }> = {
      steps: { min: 100, max: 100000 },
      sleep: { min: 1, max: 24 },
      weight: { min: 1, max: 500 },
    };

    const range = targetRanges[newGoal.type] || { min: 0, max: 999999 };
    const allowDecimal = newGoal.type === 'sleep' || newGoal.type === 'weight';
    const targetValidation = validateNumber(newGoal.target, { min: range.min, max: range.max, allowDecimal });

    if (!targetValidation.isValid) {
      toast.error(`Target must be between ${range.min} and ${range.max}`);
      return;
    }

    // Validate deadline if provided
    if (newGoal.deadline) {
      const deadlineValidation = validateDate(newGoal.deadline, {
        minDate: new Date(),
        maxDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Max 1 year
      });
      if (!deadlineValidation.isValid) {
        toast.error(deadlineValidation.error || 'Please enter a valid deadline');
        return;
      }
    }

    // Validate and sanitize SMART fields
    const smartFields = [
      { field: 'smartSpecific', value: newGoal.smartSpecific },
      { field: 'smartMeasurable', value: newGoal.smartMeasurable },
      { field: 'smartAchievable', value: newGoal.smartAchievable },
      { field: 'smartRelevant', value: newGoal.smartRelevant },
    ];

    for (const { field, value } of smartFields) {
      if (value && value.trim()) {
        const dangerCheck = containsDangerousPatterns(value);
        if (dangerCheck.dangerous) {
          toast.error(`${field.replace('smart', '')} contains invalid content`);
          return;
        }
        const textValidation = validateText(value, { maxLength: 500, allowNewlines: true });
        if (!textValidation.isValid) {
          toast.error(textValidation.error || `${field.replace('smart', '')} is invalid`);
          return;
        }
      }
    }

    // Sanitize SMART fields
    const sanitizedSmartSpecific = newGoal.smartSpecific ? sanitizeText(newGoal.smartSpecific, { maxLength: 500, allowNewlines: true }) : undefined;
    const sanitizedSmartMeasurable = newGoal.smartMeasurable ? sanitizeText(newGoal.smartMeasurable, { maxLength: 500, allowNewlines: true }) : undefined;
    const sanitizedSmartAchievable = newGoal.smartAchievable ? sanitizeText(newGoal.smartAchievable, { maxLength: 500, allowNewlines: true }) : undefined;
    const sanitizedSmartRelevant = newGoal.smartRelevant ? sanitizeText(newGoal.smartRelevant, { maxLength: 500, allowNewlines: true }) : undefined;

    setLoading(true);
    try {
      const goal: Omit<HealthGoal, 'id' | 'createdAt'> = {
        userId,
        type: newGoal.type,
        target: newGoal.target,
        period: newGoal.period,
        deadline: newGoal.deadline || undefined,
        smartSpecific: sanitizedSmartSpecific,
        smartMeasurable: sanitizedSmartMeasurable,
        smartAchievable: sanitizedSmartAchievable,
        smartRelevant: sanitizedSmartRelevant,
      };

      const createdGoal = await createGoal(goal);

      if (createdGoal) {
        setGoals([createdGoal, ...goals]);
        setShowAddGoal(false);
        setWizardStep(0);
        setNewGoal({
          type: 'steps',
          target: 10000,
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
      toast.error('Failed to create goal');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGoal = async () => {
    if (!editingGoal) return;

    // Validate period
    const validPeriods = ['daily', 'weekly', 'monthly'] as const;
    const periodValidation = validateEnum(editingGoal.period, validPeriods);
    if (!periodValidation.isValid) {
      toast.error('Please select a valid period');
      return;
    }

    // Validate target
    const targetRanges: Record<string, { min: number; max: number }> = {
      steps: { min: 100, max: 100000 },
      sleep: { min: 1, max: 24 },
      weight: { min: 1, max: 500 },
    };

    const range = targetRanges[editingGoal.type] || { min: 0, max: 999999 };
    const allowDecimal = editingGoal.type === 'sleep' || editingGoal.type === 'weight';
    const targetValidation = validateNumber(editingGoal.target, { min: range.min, max: range.max, allowDecimal });
    if (!targetValidation.isValid) {
      toast.error(`Target must be between ${range.min} and ${range.max}`);
      return;
    }

    // Validate deadline if provided
    if (editingGoal.deadline) {
      const deadlineValidation = validateDate(editingGoal.deadline, {
        minDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Allow yesterday for existing goals
        maxDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      if (!deadlineValidation.isValid) {
        toast.error(deadlineValidation.error || 'Please enter a valid deadline');
        return;
      }
    }

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

    // Only count biomarkers logged AFTER the goal was created
    const goalCreatedAt = new Date(goal.createdAt);

    // Use the later of the period start or goal creation as the cutoff
    // But set both to start of their respective days to avoid timezone issues with time precision
    const goalCreatedDate = new Date(goalCreatedAt.getFullYear(), goalCreatedAt.getMonth(), goalCreatedAt.getDate());
    const effectiveStartDate = filterDate > goalCreatedDate ? filterDate : goalCreatedDate;

    const relevantData = biomarkers.filter(b => {
      if (b.type !== goal.type) return false;
      const biomarkerDate = new Date(b.timestamp);
      // Compare dates at the day level to avoid timezone precision issues
      const biomarkerDay = new Date(biomarkerDate.getFullYear(), biomarkerDate.getMonth(), biomarkerDate.getDate());
      return biomarkerDay >= effectiveStartDate;
    });

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
    const units: Record<string, string> = {
      steps: 'steps',
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
            <div>
              <Label>Target Value</Label>
              <Input
                type="number"
                value={newGoal.target}
                onChange={(e) => setNewGoal({ ...newGoal, target: parseInt(e.target.value) })}
                className="mt-1"
              />
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
            <Card className="p-4 bg-muted/50 space-y-1 gap-1">
              <h4 className="font-medium text-sm">Goal Summary</h4>
              <p className="text-sm"><strong>Type:</strong> {getGoalTypeLabel(newGoal.type)}</p>
              <p className="text-sm"><strong>Target:</strong> {newGoal.target}</p>
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
      <DialogContent className="w-[min(95vw,56rem)] max-h-[90dvh] flex flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Health Goals
          </DialogTitle>
          <DialogDescription>Set and track your health and fitness goals using the SMART framework</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex shrink-0 gap-2 border-b pb-2">
          <Button
            type="button"
            variant={activeTab === 'active' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('active')}
          >
            <ListTodo className="w-4 h-4 mr-2" />
            Active Goals ({activeGoals.length})
          </Button>
          <Button
            type="button"
            variant={activeTab === 'past' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('past')}
          >
            <History className="w-4 h-4 mr-2" />
            Past Goals ({pastGoals.length})
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-2">
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
                  <Button type="button" onClick={() => { setShowAddGoal(true); setWizardStep(0); }} disabled={loading}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create SMART Goal
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {!showAddGoal && !editingGoal && (
                    <Button type="button" onClick={() => { setShowAddGoal(true); setWizardStep(0); }} className="w-full" disabled={loading}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create SMART Goal
                    </Button>
                  )}

                  {showAddGoal && (
                    <Card className="p-4 sm:p-6 border-2 border-primary gap-2">
                      {/* SMART Step Indicators */}
                      <div className="flex items-center justify-center gap-1 mb-6 overflow-x-auto pb-2">
                        {SMART_STEPS.map((s, i) => (
                          <div key={s.key} className="flex items-center">
                            <button
                              type="button"
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

                      <div className="flex gap-2 mt-6 flex-wrap">
                        {wizardStep > 0 && (
                          <Button type="button" variant="outline" onClick={() => setWizardStep(wizardStep - 1)}>
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Back
                          </Button>
                        )}
                        <div className="flex-1" />
                        {wizardStep < SMART_STEPS.length - 1 ? (
                          <Button type="button" onClick={() => setWizardStep(wizardStep + 1)}>
                            Next
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        ) : (
                          <Button type="button" onClick={handleAddGoal} disabled={loading}>
                            {loading ? 'Creating...' : 'Create Goal'}
                          </Button>
                        )}
                        <Button type="button" variant="outline" onClick={() => { setShowAddGoal(false); setWizardStep(0); }} disabled={loading}>Cancel</Button>
                      </div>
                    </Card>
                  )}

              {activeGoals.map((goal) => {
                const progress = getGoalProgress(goal);
                const isEditing = editingGoal?.id === goal.id;

                return (
                  <Card key={`${goal.id}-${refreshTrigger}`} className="p-6">
                    {isEditing ? (
                      <div className="space-y-4">
                        <h3>Edit Goal</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          <Button type="button" onClick={handleUpdateGoal} className="flex-1" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setEditingGoal(null)} disabled={loading}>Cancel</Button>
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
                            <Button type="button" variant="ghost" size="icon" onClick={() => setEditingGoal(goal)} disabled={loading}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)} disabled={loading}>
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
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)} disabled={loading}>
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
