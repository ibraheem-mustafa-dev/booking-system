'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDownIcon } from 'lucide-react';
import {
  CustomFieldsEditor,
  type CustomField,
} from './custom-fields-editor';

// ---------------------------------------------------------------------------
// Email settings types
// ---------------------------------------------------------------------------

interface EmailPanel {
  enabled: boolean;
  subject: string;
  body: string;
}

interface ReviewRequestSettings extends EmailPanel {
  delayMinutes: number;
}

interface FollowUpReminderSettings extends EmailPanel {
  delayDays: number;
}

interface EmailSettings {
  reviewRequest: ReviewRequestSettings;
  followUpReminder: FollowUpReminderSettings;
}

const defaultEmailSettings: EmailSettings = {
  reviewRequest: {
    enabled: false,
    delayMinutes: 120,
    subject: 'How was your {{bookingType}}?',
    body: 'Hi {{clientName}},\n\nWe hope you enjoyed your {{bookingType}} on {{bookingDate}}.\n\nWe would love to hear your feedback!',
  },
  followUpReminder: {
    enabled: false,
    delayDays: 30,
    subject: 'Time to book your next {{bookingType}}',
    body: 'Hi {{clientName}},\n\nIt has been a while since your last {{bookingType}}. Ready to book another session?',
  },
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(256),
  description: z.string().max(5000).optional(),
  durationMins: z.number().int().min(5, 'Minimum 5 minutes').max(480),
  bufferMins: z.number().int().min(0).max(120),
  locationType: z.enum(['online', 'in_person', 'phone']),
  locationDetails: z.string().max(500).optional(),
  videoProvider: z.enum(['google_meet', 'zoom', 'microsoft_teams', 'none']),
  colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  isActive: z.boolean(),
  maxAdvanceDays: z.number().int().min(1).max(365),
  minNoticeHours: z.number().int().min(0).max(168),
  requiresPayment: z.boolean(),
  priceAmount: z.string().optional(),
  priceCurrency: z.string().max(3),
});

export type BookingTypeFormValues = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// Preset colours
// ---------------------------------------------------------------------------

const presetColours = [
  '#0F7E80', // teal (brand)
  '#F87A1F', // orange (brand accent)
  '#2563EB', // blue
  '#7C3AED', // purple
  '#DC2626', // red
  '#059669', // green
  '#D97706', // amber
  '#6366F1', // indigo
  '#EC4899', // pink
  '#0891B2', // cyan
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BookingTypeFormProps {
  defaultValues?: Partial<BookingTypeFormValues> & {
    customFields?: { fields: CustomField[] };
    emailSettings?: EmailSettings;
  };
  onSubmit: (
    values: BookingTypeFormValues & {
      customFields: { fields: CustomField[] };
      emailSettings: EmailSettings;
    },
  ) => void;
  isPending: boolean;
  submitLabel: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookingTypeForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
}: BookingTypeFormProps) {
  const form = useForm<BookingTypeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      durationMins: 30,
      bufferMins: 15,
      locationType: 'online',
      locationDetails: '',
      videoProvider: 'google_meet',
      colour: '#0F7E80',
      isActive: true,
      maxAdvanceDays: 60,
      minNoticeHours: 2,
      requiresPayment: false,
      priceAmount: '',
      priceCurrency: 'GBP',
      ...defaultValues,
    },
  });

  const customFieldsDefault = defaultValues?.customFields?.fields ?? [];
  const [customFields, setCustomFields] =
    useState<CustomField[]>(customFieldsDefault);

  const [emailSettings, setEmailSettings] = useState<EmailSettings>(
    defaultValues?.emailSettings ?? defaultEmailSettings,
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const locationType = form.watch('locationType');
  const requiresPayment = form.watch('requiresPayment');
  const selectedColour = form.watch('colour');

  function handleSubmit(values: BookingTypeFormValues) {
    onSubmit({
      ...values,
      customFields: { fields: customFields },
      emailSettings,
    });
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Basic details */}
      <Card>
        <CardHeader>
          <CardTitle>Basic details</CardTitle>
          <CardDescription>
            Name, description, and duration of this booking type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. 30-minute consultation"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Briefly describe what this booking is for"
              rows={3}
              {...form.register('description')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="durationMins">Duration (minutes)</Label>
              <Input
                id="durationMins"
                type="number"
                min={5}
                max={480}
                {...form.register('durationMins', { valueAsNumber: true })}
              />
              {form.formState.errors.durationMins && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.durationMins.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bufferMins">Buffer time (minutes)</Label>
              <Input
                id="bufferMins"
                type="number"
                min={0}
                max={120}
                {...form.register('bufferMins', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Gap between consecutive bookings
              </p>
            </div>
          </div>

          {/* Colour picker */}
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {presetColours.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="size-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: selectedColour === c ? '#000' : 'transparent',
                    outline:
                      selectedColour === c ? '2px solid #000' : 'none',
                    outlineOffset: '2px',
                  }}
                  onClick={() => form.setValue('colour', c)}
                >
                  <span className="sr-only">Select colour {c}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>
            How will this meeting take place?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Meeting type</Label>
            <Select
              value={locationType}
              onValueChange={(value) =>
                form.setValue(
                  'locationType',
                  value as 'online' | 'in_person' | 'phone',
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online (video call)</SelectItem>
                <SelectItem value="in_person">In person</SelectItem>
                <SelectItem value="phone">Phone call</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {locationType === 'online' && (
            <div className="space-y-1.5">
              <Label>Video provider</Label>
              <Select
                value={form.watch('videoProvider')}
                onValueChange={(value) =>
                  form.setValue(
                    'videoProvider',
                    value as
                      | 'google_meet'
                      | 'zoom'
                      | 'microsoft_teams'
                      | 'none',
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google_meet">Google Meet</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="microsoft_teams">
                    Microsoft Teams
                  </SelectItem>
                  <SelectItem value="none">
                    No auto-generated link
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {locationType === 'in_person' && (
            <div className="space-y-1.5">
              <Label htmlFor="locationDetails">Address / location</Label>
              <Input
                id="locationDetails"
                placeholder="e.g. 123 High Street, London"
                {...form.register('locationDetails')}
              />
            </div>
          )}

          {locationType === 'phone' && (
            <div className="space-y-1.5">
              <Label htmlFor="locationDetails">Phone notes (optional)</Label>
              <Input
                id="locationDetails"
                placeholder="e.g. We will call you at your provided number"
                {...form.register('locationDetails')}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduling</CardTitle>
          <CardDescription>
            Control how far in advance people can book.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="maxAdvanceDays">
                Maximum advance booking (days)
              </Label>
              <Input
                id="maxAdvanceDays"
                type="number"
                min={1}
                max={365}
                {...form.register('maxAdvanceDays', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minNoticeHours">
                Minimum notice (hours)
              </Label>
              <Input
                id="minNoticeHours"
                type="number"
                min={0}
                max={168}
                {...form.register('minNoticeHours', { valueAsNumber: true })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom fields */}
      <Card>
        <CardHeader>
          <CardTitle>Custom fields</CardTitle>
          <CardDescription>
            Collect additional information from people when they book.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomFieldsEditor
            fields={customFields}
            onChange={setCustomFields}
          />
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
          <CardDescription>
            Optionally require payment when booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              id="requiresPayment"
              checked={requiresPayment}
              onCheckedChange={(checked) =>
                form.setValue('requiresPayment', checked)
              }
            />
            <Label htmlFor="requiresPayment">Require payment</Label>
          </div>

          {requiresPayment && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="priceAmount">Price</Label>
                <Input
                  id="priceAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...form.register('priceAmount')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select
                  value={form.watch('priceCurrency')}
                  onValueChange={(value) =>
                    form.setValue('priceCurrency', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Email notifications</CardTitle>
          <CardDescription>
            Automated follow-up emails sent after a booking. Use{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              {'{{clientName}}'}
            </code>
            ,{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              {'{{bookingType}}'}
            </code>
            ,{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              {'{{bookingDate}}'}
            </code>{' '}
            and{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              {'{{hostName}}'}
            </code>{' '}
            as placeholders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Review request panel */}
          <Collapsible open={reviewOpen} onOpenChange={setReviewOpen}>
            <div className="rounded-lg border border-border bg-muted/30">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: emailSettings.reviewRequest.enabled
                          ? '#F87A1F'
                          : '#52525B',
                      }}
                    />
                    <span className="text-sm font-medium">Review request</span>
                    {emailSettings.reviewRequest.enabled && (
                      <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-400">
                        On
                      </span>
                    )}
                  </div>
                  <ChevronDownIcon
                    className="size-4 text-muted-foreground transition-transform duration-200"
                    style={{ transform: reviewOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-4 border-t border-border px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="reviewRequest-enabled"
                      checked={emailSettings.reviewRequest.enabled}
                      onCheckedChange={(checked) =>
                        setEmailSettings((prev) => ({
                          ...prev,
                          reviewRequest: { ...prev.reviewRequest, enabled: checked },
                        }))
                      }
                    />
                    <Label htmlFor="reviewRequest-enabled">Enable review request</Label>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reviewRequest-delay">Send after (minutes)</Label>
                    <Input
                      id="reviewRequest-delay"
                      type="number"
                      min={0}
                      max={10080}
                      className="font-mono"
                      value={emailSettings.reviewRequest.delayMinutes}
                      onChange={(e) =>
                        setEmailSettings((prev) => ({
                          ...prev,
                          reviewRequest: {
                            ...prev.reviewRequest,
                            delayMinutes: Math.max(0, parseInt(e.target.value) || 0),
                          },
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      e.g. 120 = 2 hours after the booking ends
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reviewRequest-subject">Subject</Label>
                    <Input
                      id="reviewRequest-subject"
                      placeholder="How was your {{bookingType}}?"
                      value={emailSettings.reviewRequest.subject}
                      onChange={(e) =>
                        setEmailSettings((prev) => ({
                          ...prev,
                          reviewRequest: { ...prev.reviewRequest, subject: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reviewRequest-body">Message body</Label>
                    <Textarea
                      id="reviewRequest-body"
                      rows={5}
                      placeholder="Hi {{clientName}}, ..."
                      value={emailSettings.reviewRequest.body}
                      onChange={(e) =>
                        setEmailSettings((prev) => ({
                          ...prev,
                          reviewRequest: { ...prev.reviewRequest, body: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Follow-up reminder panel */}
          <Collapsible open={followUpOpen} onOpenChange={setFollowUpOpen}>
            <div className="rounded-lg border border-border bg-muted/30">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: emailSettings.followUpReminder.enabled
                          ? '#F87A1F'
                          : '#52525B',
                      }}
                    />
                    <span className="text-sm font-medium">Follow-up reminder</span>
                    {emailSettings.followUpReminder.enabled && (
                      <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-400">
                        On
                      </span>
                    )}
                  </div>
                  <ChevronDownIcon
                    className="size-4 text-muted-foreground transition-transform duration-200"
                    style={{ transform: followUpOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-4 border-t border-border px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="followUp-enabled"
                      checked={emailSettings.followUpReminder.enabled}
                      onCheckedChange={(checked) =>
                        setEmailSettings((prev) => ({
                          ...prev,
                          followUpReminder: { ...prev.followUpReminder, enabled: checked },
                        }))
                      }
                    />
                    <Label htmlFor="followUp-enabled">Enable follow-up reminder</Label>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="followUp-delay">Send after (days)</Label>
                    <Input
                      id="followUp-delay"
                      type="number"
                      min={1}
                      max={365}
                      className="font-mono"
                      value={emailSettings.followUpReminder.delayDays}
                      onChange={(e) =>
                        setEmailSettings((prev) => ({
                          ...prev,
                          followUpReminder: {
                            ...prev.followUpReminder,
                            delayDays: Math.max(1, parseInt(e.target.value) || 1),
                          },
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      e.g. 30 = one month after the booking
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="followUp-subject">Subject</Label>
                    <Input
                      id="followUp-subject"
                      placeholder="Time to book your next {{bookingType}}"
                      value={emailSettings.followUpReminder.subject}
                      onChange={(e) =>
                        setEmailSettings((prev) => ({
                          ...prev,
                          followUpReminder: { ...prev.followUpReminder, subject: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="followUp-body">Message body</Label>
                    <Textarea
                      id="followUp-body"
                      rows={5}
                      placeholder="Hi {{clientName}}, ..."
                      value={emailSettings.followUpReminder.body}
                      onChange={(e) =>
                        setEmailSettings((prev) => ({
                          ...prev,
                          followUpReminder: { ...prev.followUpReminder, body: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Active status + submit */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="isActive"
            checked={form.watch('isActive')}
            onCheckedChange={(checked) =>
              form.setValue('isActive', checked)
            }
          />
          <Label htmlFor="isActive">Active (visible to public)</Label>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

