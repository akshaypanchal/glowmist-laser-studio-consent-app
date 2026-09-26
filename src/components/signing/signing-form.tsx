// The client-facing consent form: details, treatments, medical history, consent wording, photography choices, the e-signature agreement and the signature. Sends everything to the server, which does all the real checking.

"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { answersSchema } from "@/lib/consent-answers";
import type { TemplateContent } from "@/lib/consent-template";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

type Props = {
  token: string;
  reference: string;
  content: TemplateContent;
  client: { firstName: string; lastName: string; email: string; phone: string };
};

const DETAIL_FIELDS = [
  { name: "fullName", label: "Full name", type: "text", autoComplete: "name" },
  { name: "dateOfBirth", label: "Date of birth", type: "date", autoComplete: "bday" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
  { name: "mailingAddress", label: "Mailing address", type: "text", autoComplete: "street-address", wide: true },
  { name: "emergencyContact", label: "Emergency contact", type: "text", autoComplete: "off" },
  { name: "emergencyPhone", label: "Emergency phone", type: "tel", autoComplete: "off" },
  { name: "dateOfService", label: "Date of service", type: "date", autoComplete: "off" },
] as const;

type DetailName = (typeof DETAIL_FIELDS)[number]["name"];

function toggle(list: string[], value: string, on: boolean) {
  return on ? [...list, value] : list.filter((v) => v !== value);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-4 text-sm font-semibold tracking-wide text-brand-700 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Check({ label, checked, onChange, name }: { label: string; checked: boolean; onChange: (v: boolean) => void; name?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 py-1 text-sm">
      <input
        type="checkbox"
        name={name}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function SigningForm({ token, reference, content, client }: Props) {
  const [details, setDetails] = useState<Record<DetailName, string>>({
    fullName: `${client.firstName} ${client.lastName}`.trim(),
    dateOfBirth: "",
    email: client.email,
    phone: client.phone,
    mailingAddress: "",
    emergencyContact: "",
    emergencyPhone: "",
    dateOfService: new Date().toLocaleDateString("en-CA"),
  });
  const [treatments, setTreatments] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState("");
  const [otherConditions, setOtherConditions] = useState("");
  const [photography, setPhotography] = useState<string[]>([]);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [signerName, setSignerName] = useState(`${client.firstName} ${client.lastName}`.trim());
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ reference: string } | null>(null);
  const pad = useRef<SignaturePadHandle>(null);

  const exclusive = new Set(content.photography.options.filter((o) => o.exclusive).map((o) => o.id));

  function choosePhoto(id: string, on: boolean) {
    if (!on) return setPhotography((p) => p.filter((v) => v !== id));
    // "I do not consent" clears the others, and choosing another option clears it.
    setPhotography((p) => (exclusive.has(id) ? [id] : [...p.filter((v) => !exclusive.has(v)), id]));
  }

  async function onConsentChange(checked: boolean) {
    setConsentAccepted(checked);
    if (checked) {
      // Audit trail only; the server checks consentAccepted again on submit.
      fetch(`/api/signing/${token}/consent`, { method: "POST" }).catch(() => {});
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const answers = { client: details, treatments, medicalConditions: conditions, allergies, otherConditions, photography };
    const check = answersSchema(content).safeParse(answers);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    if (!consentAccepted) return setError("Please tick the box to agree to sign electronically.");
    if (!signerName.trim()) return setError("Please type your full name.");
    if (!pad.current || pad.current.isEmpty()) return setError("Please draw your signature.");

    setSubmitting(true);
    try {
      const response = await fetch(`/api/signing/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentAccepted, signature: pad.current.toPng(), signerName, answers }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Something went wrong. Please try again.");
        setFieldErrors(data.fieldErrors ?? {});
        return;
      }
      setDone({ reference: data.reference });
      window.scrollTo({ top: 0 });
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center" role="status">
        <h3 className="mb-2 text-xl font-semibold text-emerald-900">Thank you, your consent form is signed.</h3>
        <p className="text-emerald-900">
          Your document ID is <span className="font-mono">{done.reference}</span>. A copy will be emailed to{" "}
          {details.email}. You can close this page.
        </p>
      </div>
    );
  }

  const canSubmit = consentAccepted && hasSignature && signerName.trim().length > 0 && !submitting;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Section title="Client information">
        <div className="grid gap-4 sm:grid-cols-2">
          {DETAIL_FIELDS.map((f) => (
            <div key={f.name} className={"wide" in f && f.wide ? "sm:col-span-2" : undefined}>
              <Label htmlFor={f.name}>{f.label}</Label>
              <Input
                id={f.name}
                name={f.name}
                type={f.type}
                autoComplete={f.autoComplete}
                required
                value={details[f.name]}
                onChange={(e) => setDetails((d) => ({ ...d, [f.name]: e.target.value }))}
              />
              {fieldErrors.client && <span className="sr-only">{fieldErrors.client[0]}</span>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Treatment(s) requested">
        <p className="mb-2 text-sm text-stone-600">Please check all that apply.</p>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {content.treatments.map((t) => (
            <Check key={t} name="treatments" label={t} checked={treatments.includes(t)} onChange={(on) => setTreatments((l) => toggle(l, t, on))} />
          ))}
        </div>
      </Section>

      <Section title="Medical history">
        <p className="mb-2 text-sm text-stone-600">Please check all that apply.</p>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {content.medicalConditions.map((m) => (
            <Check key={m} name="medicalConditions" label={m} checked={conditions.includes(m)} onChange={(on) => setConditions((l) => toggle(l, m, on))} />
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="allergies">Allergies (please specify)</Label>
            <Textarea id="allergies" rows={2} value={allergies} onChange={(e) => setAllergies(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="otherConditions">Other medical conditions</Label>
            <Textarea id="otherConditions" rows={2} value={otherConditions} onChange={(e) => setOtherConditions(e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Client consent">
        <div className="space-y-3 text-sm leading-relaxed text-stone-800">
          {content.consentIntro.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p className="font-medium">I understand that:</p>
          <ul className="list-disc space-y-1 pl-5">
            {content.understandings.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title={content.photography.heading}>
        {content.photography.options.map((o) => (
          <Check key={o.id} name="photography" label={o.label} checked={photography.includes(o.id)} onChange={(on) => choosePhoto(o.id, on)} />
        ))}
      </Section>

      <Section title="Acknowledgement">
        {content.acknowledgement.map((p) => (
          <p key={p} className="text-sm leading-relaxed text-stone-800">
            {p}
          </p>
        ))}
      </Section>

      <Section title="Electronic signature">
        <Check label={content.electronicSignatureConsent} checked={consentAccepted} onChange={onConsentChange} name="consentAccepted" />
        <div className="mt-4">
          <Label htmlFor="signerName">Client name (print)</Label>
          <Input id="signerName" value={signerName} onChange={(e) => setSignerName(e.target.value)} autoComplete="name" />
        </div>
        <div className="mt-4">
          <Label>Signature</Label>
          <SignaturePad ref={pad} onChange={setHasSignature} />
          <Button type="button" variant="ghost" className="mt-2 px-2" onClick={() => pad.current?.clear()}>
            Clear signature
          </Button>
        </div>
      </Section>

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        <Button type="submit" disabled={!canSubmit} className="w-full py-3 text-base sm:w-auto sm:px-10">
          {submitting ? "Signing…" : "Sign & Submit"}
        </Button>
        <p className="text-xs text-stone-500">Document {reference}</p>
      </div>
    </form>
  );
}
