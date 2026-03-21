import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Send, Bot } from 'lucide-react';
import { Biomarker, Device, getBiomarkerLabel, getBiomarkerUnit } from '../../utils/mockData';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { checkRateLimit, peekRateLimit } from '../../utils/rateLimiter';
import { toast } from 'sonner';
import {
  validateText,
  sanitizeText,
  containsDangerousPatterns,
  stripHtml,
} from '../../utils/inputValidation';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface VirtualCompanionProps {
  isOpen: boolean;
  onClose: () => void;
  biomarkers: Biomarker[];
  devices: Device[];
  user: any;
}

export function VirtualCompanion({ isOpen, onClose, biomarkers, devices, user }: VirtualCompanionProps) {
  const MAX_MESSAGES = 200; // Cap to prevent unbounded memory growth
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `Hello ${user.name}! I'm your health companion. I can help you understand your biomarkers, provide health insights, and answer questions about your devices. How can I assist you today?`,
      sender: 'assistant',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getLatestBiomarker = (type: Biomarker['type']) => {
    const filtered = biomarkers.filter(b => b.type === type);
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  };

  const generateResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase();

    // Heart rate queries
    if (msg.includes('heart') || msg.includes('pulse')) {
      const latest = getLatestBiomarker('heartRate');
      if (latest) {
        const status = latest.value >= 60 && latest.value <= 100 ? 'normal' : 'abnormal';
        return `Your latest heart rate is ${latest.value} bpm, which is ${status}. ${
          status === 'abnormal' 
            ? 'I recommend consulting with your healthcare provider if this persists.' 
            : 'Keep up the good work maintaining a healthy heart rate!'
        }`;
      }
      return "I don't have any heart rate data yet. Please sync your device to enable heart rate insights and recommendations.";
    }

    // Blood pressure queries
    if (msg.includes('blood pressure') || msg.includes('bp')) {
      const latest = getLatestBiomarker('bloodPressure');
      if (latest) {
        return `Your latest blood pressure reading is ${latest.systolic}/${latest.diastolic} mmHg. ${
          latest.systolic! < 120 && latest.diastolic! < 80 
            ? 'This is within the normal range.' 
            : 'Consider monitoring this regularly and discussing with your doctor.'
        }`;
      }
      return "I don't have any blood pressure data yet. Please sync your device to enable blood pressure insights and recommendations.";
    }

    // Glucose queries
    if (msg.includes('glucose') || msg.includes('sugar') || msg.includes('diabetes')) {
      const latest = getLatestBiomarker('glucose');
      if (latest) {
        const status = latest.value >= 70 && latest.value <= 130 ? 'normal' : 'outside normal range';
        return `Your blood glucose level is ${latest.value} mg/dL, which is ${status}. ${
          status !== 'normal' 
            ? 'Please monitor this closely and consult your healthcare provider.' 
            : 'Your glucose levels are looking good!'
        }`;
      }
      return "I don't have any glucose data yet. Please sync your device to enable glucose insights and recommendations.";
    }

    // Steps/activity queries
    if (msg.includes('steps') || msg.includes('walk') || msg.includes('activity')) {
      const latest = getLatestBiomarker('steps');
      if (latest) {
        const goal = 10000;
        const percentage = (latest.value / goal * 100).toFixed(0);
        return `You've taken ${Math.round(latest.value).toLocaleString()} steps today, which is ${percentage}% of your 10,000 step goal. ${
          latest.value >= goal 
            ? 'Excellent work! You have reached your goal! 🎉' 
            : `You're doing great! Keep moving to reach your goal.`
        }`;
      }
      return "I don't have any step data yet. Please sync your device to enable activity insights and recommendations.";
    }

    // Sleep queries
    if (msg.includes('sleep')) {
      const latest = getLatestBiomarker('sleep');
      if (latest) {
        const quality = latest.value >= 7 ? 'good' : 'insufficient';
        return `You slept for ${latest.value.toFixed(1)} hours last night, which is ${quality}. ${
          quality === 'insufficient' 
            ? 'Try to aim for 7-9 hours of sleep for optimal health.' 
            : 'Great job getting enough rest!'
        }`;
      }
      return "I don't have any sleep data yet. Please sync your device to enable sleep insights and recommendations.";
    }

    // Device queries
    if (msg.includes('device') || msg.includes('watch') || msg.includes('monitor')) {
      const activeDevices = devices.filter(d => d.status === 'active').length;
      const faultyDevices = devices.filter(d => d.status === 'faulty').length;
      return `You have ${devices.length} registered device${devices.length !== 1 ? 's' : ''}. ${activeDevices} are active${
        faultyDevices > 0 ? ` and ${faultyDevices} have detected faults` : ''
      }. ${
        faultyDevices > 0 
          ? 'Please check your faulty devices and try resyncing them.' 
          : 'All your devices are working properly!'
      }`;
    }

    // Recommendations
    if (msg.includes('recommend') || msg.includes('advice') || msg.includes('suggest')) {
      const steps = getLatestBiomarker('steps');
      const hr = getLatestBiomarker('heartRate');
      
      if (steps && steps.value < 5000) {
        return "Based on your activity today, I recommend taking a 20-30 minute walk. The best time would be late afternoon when your energy levels are typically higher.";
      }
      if (hr && hr.value > 100) {
        return "Your heart rate has been elevated. I suggest some relaxation techniques like deep breathing or meditation. Also, make sure you're staying hydrated.";
      }
      return "Keep maintaining your current healthy habits! Regular exercise, balanced nutrition, and adequate sleep are key. Stay consistent with tracking your biomarkers.";
    }

    // Summary
    if (msg.includes('summary') || msg.includes('overview')) {
      const hr = getLatestBiomarker('heartRate');
      const steps = getLatestBiomarker('steps');
      const sleep = getLatestBiomarker('sleep');
      
      return `Here's your health summary:\n\n• Heart Rate: ${hr?.value || '--'} bpm\n• Steps: ${steps ? Math.round(steps.value).toLocaleString() : '--'}\n• Sleep: ${sleep?.value.toFixed(1) || '--'} hours\n\nOverall, you're doing well! Keep up with your health monitoring.`;
    }

    // Default responses
    const responses = [
      "I can help you with information about your heart rate, blood pressure, glucose levels, steps, sleep, and devices. What would you like to know?",
      "I'm here to help you understand your health data. You can ask me about specific biomarkers or get recommendations.",
      "Feel free to ask me about your health metrics, device status, or get personalized health recommendations.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleSend = () => {
    if (!input.trim()) return;

    // Validate message length and content
    const messageValidation = validateText(input, {
      minLength: 1,
      maxLength: 500,
      required: true,
    });

    if (!messageValidation.isValid) {
      toast.error('Message is too long (max 500 characters)');
      return;
    }

    // Check for dangerous patterns (XSS, script injection)
    const dangerCheck = containsDangerousPatterns(input);
    if (dangerCheck.dangerous) {
      toast.error('Invalid message content');
      return;
    }

    // Rate limit check
    const rateCheck = checkRateLimit('chatMessage', user.id || 'anonymous');
    if (!rateCheck.allowed) {
      toast.error(rateCheck.message);
      return;
    }

    // Sanitize and strip any HTML from user input
    const sanitizedInput = stripHtml(sanitizeText(input, { maxLength: 500, escapeHtml: false }));

    const userMessage: Message = {
      id: Date.now().toString(),
      text: sanitizedInput,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => {
      const updated = [...prev, userMessage];
      // Cap message history to prevent unbounded memory growth
      return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
    });
    setInput('');
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const response = generateResponse(sanitizedInput);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => {
        const updated = [...prev, assistantMessage];
        return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
      });
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  // Show info box only if user hasn't sent a message yet
  const hasUserSentMessage = messages.some(m => m.sender === 'user');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple flex items-center justify-center text-white">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle>Health Assistant</DialogTitle>
              <DialogDescription className="text-sm text-gray-600">Your personal AI health companion</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Info box about biomarker data, only before first user message */}
        {!hasUserSentMessage && (
          <div className="px-6 pt-4">
            <div className="bg-blue-100 border border-blue-300 text-blue-800 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" /></svg>
              The companion works best once your biomarker data is loaded.
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6">
          <div className="py-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {message.sender === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple flex items-center justify-center text-white flex-shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  {message.sender === 'user' && (
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      message.sender === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                    <p className={`text-xs mt-1 ${
                      message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-custom-blue dark:to-custom-purple flex items-center justify-center text-white">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </div>

        <div className="p-4 border-t flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about your health data..."
              className="flex-1"
              maxLength={500}
            />
            <Button onClick={handleSend} disabled={!input.trim() || !peekRateLimit('chatMessage', user.id || 'anonymous').allowed}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {['Heart rate?', 'Steps today?', 'Sleep quality?', 'Recommendations?'].map(q => (
              <Button
                key={q}
                size="sm"
                variant="outline"
                onClick={() => {
                  setInput(q);
                  setTimeout(() => handleSend(), 100);
                }}
              >
                {q}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}