'use client';

import { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface CustomField {
  id: string;
  type:
    | 'text'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'file'
    | 'email'
    | 'phone'
    | 'number';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

const fieldTypeLabels: Record<CustomField['type'], string> = {
  text: 'Short text',
  textarea: 'Long text',
  select: 'Dropdown',
  checkbox: 'Checkbox',
  radio: 'Radio buttons',
  file: 'File upload',
  email: 'Email',
  phone: 'Phone number',
  number: 'Number',
};

interface CustomFieldsEditorProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}

export function CustomFieldsEditor({
  fields,
  onChange,
}: CustomFieldsEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function addField(type: CustomField['type']) {
    const newField: CustomField = {
      id: crypto.randomUUID(),
      type,
      label: '',
      placeholder: '',
      required: false,
      options: type === 'select' || type === 'radio' ? [''] : undefined,
    };
    onChange([...fields, newField]);
    setExpandedId(newField.id);
  }

  function updateField(id: string, updates: Partial<CustomField>) {
    onChange(
      fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    );
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function moveField(id: string, direction: 'up' | 'down') {
    const index = fields.findIndex((f) => f.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [
      newFields[newIndex],
      newFields[index],
    ];
    onChange(newFields);
  }

  function addOption(fieldId: string) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    updateField(fieldId, {
      options: [...(field.options || []), ''],
    });
  }

  function updateOption(fieldId: string, optionIndex: number, value: string) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field?.options) return;
    const newOptions = [...field.options];
    newOptions[optionIndex] = value;
    updateField(fieldId, { options: newOptions });
  }

  function removeOption(fieldId: string, optionIndex: number) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field?.options) return;
    updateField(fieldId, {
      options: field.options.filter((_, i) => i !== optionIndex),
    });
  }

  return (
    <div className="space-y-3">
      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <Card key={field.id}>
              <CardContent className="p-3">
                {/* Header row — always visible */}
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 text-muted-foreground shrink-0" />
                  <Badge variant="outline" className="text-xs shrink-0">
                    {fieldTypeLabels[field.type]}
                  </Badge>
                  <span
                    className="text-sm font-medium truncate flex-1 cursor-pointer"
                    onClick={() =>
                      setExpandedId(
                        expandedId === field.id ? null : field.id,
                      )
                    }
                  >
                    {field.label || '(untitled field)'}
                  </span>
                  {field.required && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      Required
                    </Badge>
                  )}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={index === 0}
                      onClick={() => moveField(field.id, 'up')}
                    >
                      <ArrowUp className="size-3.5" />
                      <span className="sr-only">Move up</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={index === fields.length - 1}
                      onClick={() => moveField(field.id, 'down')}
                    >
                      <ArrowDown className="size-3.5" />
                      <span className="sr-only">Move down</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => removeField(field.id)}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Remove field</span>
                    </Button>
                  </div>
                </div>

                {/* Expanded editor */}
                {expandedId === field.id && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`field-label-${field.id}`}>
                          Label
                        </Label>
                        <Input
                          id={`field-label-${field.id}`}
                          value={field.label}
                          onChange={(e) =>
                            updateField(field.id, { label: e.target.value })
                          }
                          placeholder="e.g. Company name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`field-placeholder-${field.id}`}>
                          Placeholder
                        </Label>
                        <Input
                          id={`field-placeholder-${field.id}`}
                          value={field.placeholder || ''}
                          onChange={(e) =>
                            updateField(field.id, {
                              placeholder: e.target.value,
                            })
                          }
                          placeholder="e.g. Acme Ltd"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        id={`field-required-${field.id}`}
                        checked={field.required}
                        onCheckedChange={(checked) =>
                          updateField(field.id, { required: checked })
                        }
                      />
                      <Label htmlFor={`field-required-${field.id}`}>
                        Required field
                      </Label>
                    </div>

                    {/* Options editor for select/radio fields */}
                    {(field.type === 'select' || field.type === 'radio') && (
                      <div className="space-y-2">
                        <Label>Options</Label>
                        {field.options?.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            className="flex items-center gap-2"
                          >
                            <Input
                              value={option}
                              onChange={(e) =>
                                updateOption(
                                  field.id,
                                  optIndex,
                                  e.target.value,
                                )
                              }
                              placeholder={`Option ${optIndex + 1}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0"
                              onClick={() =>
                                removeOption(field.id, optIndex)
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(field.id)}
                        >
                          <Plus className="mr-1 size-3.5" />
                          Add option
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add field dropdown */}
      <Select onValueChange={(value) => addField(value as CustomField['type'])}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Plus className="size-4" />
            <SelectValue placeholder="Add a custom field" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(fieldTypeLabels).map(([type, label]) => (
            <SelectItem key={type} value={type}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
