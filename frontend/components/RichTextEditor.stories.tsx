import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import RichTextEditor from "./RichTextEditor";

const meta = {
  title: "Components/RichTextEditor",
  component: RichTextEditor,
  parameters: {
    layout: "padded",
    a11y: {
      element: "#storybook-root",
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RichTextEditor>;

export default meta;
type Story = StoryObj<typeof RichTextEditor>;

export const Default: Story = {
  render: function RenderDefault() {
    const [value, setValue] = useState(
      "<p>We are looking for a skilled <strong>Soroban</strong> developer to build an escrow smart contract.</p>"
    );
    return (
      <div className="max-w-xl mx-auto space-y-2">
        <label id="job-desc-label" className="text-sm font-medium text-slate-700">
          Job Description
        </label>
        <RichTextEditor
          labelId="job-desc-label"
          value={value}
          onChange={setValue}
          maxBytes={4096}
        />
      </div>
    );
  },
};

export const WithError: Story = {
  render: function RenderWithError() {
    const [value, setValue] = useState("");
    return (
      <div className="max-w-xl mx-auto space-y-2">
        <label id="job-desc-error-label" className="text-sm font-medium text-slate-700">
          Job Description (Required)
        </label>
        <RichTextEditor
          labelId="job-desc-error-label"
          value={value}
          onChange={setValue}
          required
          error="Job description is required"
          errorId="job-desc-error-msg"
        />
        <p id="job-desc-error-msg" className="text-xs text-red-600" role="alert">
          Job description is required
        </p>
      </div>
    );
  },
};

export const AccessibleToolbar: Story = {
  render: function RenderAccessibleToolbar() {
    const [value, setValue] = useState("<p>Navigate the toolbar using Left and Right arrow keys.</p>");
    return (
      <div className="max-w-xl mx-auto space-y-2">
        <p className="text-xs text-slate-500">
          Focus a toolbar button and press <kbd className="font-mono bg-slate-100 px-1 rounded">ArrowLeft</kbd> or{" "}
          <kbd className="font-mono bg-slate-100 px-1 rounded">ArrowRight</kbd> to test roving tabindex.
        </p>
        <RichTextEditor
          value={value}
          onChange={setValue}
        />
      </div>
    );
  },
};
