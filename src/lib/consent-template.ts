import { z } from "zod";

/**
 * A template version's content is structured JSON rather than free text, so
 * the signing page, the PDF and the stored answers all come from one source.
 * The SHA-256 of its canonical JSON is the version's content_hash.
 */
export const templateContentSchema = z.object({
  title: z.string().min(1),
  studio: z.object({
    name: z.string().min(1),
    address: z.string(),
    email: z.string(),
  }),
  treatments: z.array(z.string().min(1)).min(1),
  medicalConditions: z.array(z.string().min(1)),
  consentIntro: z.array(z.string().min(1)),
  understandings: z.array(z.string().min(1)),
  photography: z.object({
    heading: z.string().min(1),
    options: z
      .array(z.object({ id: z.string().min(1), label: z.string().min(1), exclusive: z.boolean().optional() }))
      .min(1),
  }),
  acknowledgement: z.array(z.string().min(1)),
  electronicSignatureConsent: z.string().min(1),
});

export type TemplateContent = z.infer<typeof templateContentSchema>;

/** Wording taken from "GlowMist Laser Studio - Consent Form.pdf". */
export const GLOWMIST_CONSENT_V1: TemplateContent = {
  title: "Treatment Consent Form",
  studio: {
    name: "GlowMist Laser Studio",
    address: "238 Richardson Crescent, Bradford ON L3Z 0R6",
    email: "glowmistlaserstudio@gmail.com",
  },
  treatments: [
    "Laser Hair Removal",
    "Vascular Therapy",
    "Acne Removal",
    "Microneedling",
    "Hydro-Dermabrasion Facial",
    "Skin Rejuvenation",
    "Pigmentation Therapy",
  ],
  medicalConditions: [
    "Pregnant or breastfeeding",
    "Pacemaker or implanted medical device",
    "Cancer (current or previous)",
    "Epilepsy or seizure disorder",
    "Recent sunburn or tanning",
    "Taking blood thinners",
    "Taking Accutane (within the last 12 months)",
    "Blood clotting disorder",
    "Using Retinol, Retin-A or prescription exfoliating products",
    "Cold sores / Herpes simplex",
    "History of keloid scarring",
    "Photosensitivity or light sensitivity",
    "Active skin infection, rash, eczema or psoriasis in the treatment area",
    "Diabetes",
  ],
  consentIntro: [
    "I certify that the information I have provided is complete and accurate to the best of my knowledge. I understand that the treatment(s) I have selected have been explained to me, including the expected benefits, possible side effects, risks, and aftercare requirements.",
  ],
  understandings: [
    "Individual results vary and cannot be guaranteed.",
    "Multiple treatments may be required to achieve desired results.",
    "Mild redness, swelling, tenderness, dryness, bruising, or temporary pigment changes may occur depending on the treatment performed.",
    "I am responsible for following all pre-treatment and post-treatment instructions provided by GlowMist Laser Studio.",
    "I have had the opportunity to ask questions, and all of my questions have been answered to my satisfaction.",
    "I understand that I may stop treatment at any time.",
  ],
  photography: {
    heading: "Photography Consent (Optional)",
    options: [
      {
        id: "record",
        label: "I authorize GlowMist Laser Studio to take before-and-after photographs for my confidential client record.",
      },
      {
        id: "marketing",
        label:
          "I also authorize the use of my photographs for educational or marketing purposes. My identity will not be disclosed without my written permission.",
      },
      { id: "none", label: "I do not consent to photography.", exclusive: true },
    ],
  },
  acknowledgement: [
    "I understand that no guarantees or warranties have been made regarding the outcome of my treatment. I release GlowMist Laser Studio and its practitioners from liability for expected side effects and complications that may occur despite appropriate treatment and adherence to professional standards.",
  ],
  electronicSignatureConsent:
    "I agree to use an electronic signature and confirm that I have reviewed the information above.",
};
