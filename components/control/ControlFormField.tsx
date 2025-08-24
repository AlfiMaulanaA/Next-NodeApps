"use client";

import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LucideIcon, Info, AlertCircle } from "lucide-react";

interface BaseFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
}

interface InputFieldProps extends BaseFieldProps {
  type?: "text" | "number" | "email" | "password";
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  disabled?: boolean;
}

interface CheckboxFieldProps extends BaseFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

// Base Field Component
function FieldWrapper({ label, required, error, help, icon: Icon, className = "", children }: BaseFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
      {children}
      {help && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>{help}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// Input Field Component
export function ControlInputField({
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  ...fieldProps
}: InputFieldProps) {
  return (
    <FieldWrapper {...fieldProps}>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={readOnly ? "bg-muted" : ""}
      />
    </FieldWrapper>
  );
}

// Select Field Component
export function ControlSelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  ...fieldProps
}: SelectFieldProps) {
  return (
    <FieldWrapper {...fieldProps}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

// Checkbox Field Component
export function ControlCheckboxField({
  checked,
  onChange,
  disabled,
  ...fieldProps
}: CheckboxFieldProps) {
  return (
    <FieldWrapper {...fieldProps}>
      <div className="flex items-center space-x-2">
        <Checkbox
          id={fieldProps.label}
          checked={checked}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
          disabled={disabled}
        />
        <Label htmlFor={fieldProps.label} className="text-sm font-normal">
          {fieldProps.label}
        </Label>
      </div>
    </FieldWrapper>
  );
}

// Form Section Component
export function ControlFormSection({
  title,
  description,
  icon: Icon,
  children,
  className = ""
}: FormSectionProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="border-b pb-2">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}