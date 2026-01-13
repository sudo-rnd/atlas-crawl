import type { Page } from 'playwright';
import type { FormInfo, FormField } from '../types.js';

export async function extractForms(page: Page, pageUrl: string): Promise<FormInfo[]> {
  const formData = await page.evaluate(() => {
    const forms: Array<{
      action: string;
      method: string;
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
        placeholder?: string;
      }>;
    }> = [];

    document.querySelectorAll('form').forEach((form) => {
      const fields: Array<{
        name: string;
        type: string;
        required: boolean;
        placeholder?: string;
      }> = [];

      // Get all input fields
      form.querySelectorAll('input, select, textarea').forEach((field) => {
        const input = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const name = input.name || input.id || '';
        const type = input.type || field.tagName.toLowerCase();

        // Skip hidden, submit, button types for field listing
        if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) {
          return;
        }

        fields.push({
          name,
          type,
          required: input.required || input.hasAttribute('required'),
          placeholder: (input as HTMLInputElement).placeholder || undefined,
        });
      });

      forms.push({
        action: form.action || '',
        method: (form.method || 'GET').toUpperCase(),
        fields,
      });
    });

    return forms;
  });

  // Process and categorize forms
  return formData.map((form) => {
    const formInfo: FormInfo = {
      url: pageUrl,
      action: form.action || pageUrl,
      method: form.method,
      fields: form.fields as FormField[],
      formType: detectFormType(form.fields),
    };
    return formInfo;
  });
}

function detectFormType(
  fields: Array<{ name: string; type: string }>
): FormInfo['formType'] {
  const fieldNames = fields.map((f) => f.name.toLowerCase());
  const fieldTypes = fields.map((f) => f.type.toLowerCase());

  // Login form detection
  const hasPassword = fieldTypes.includes('password');
  const hasUsername = fieldNames.some((n) =>
    ['username', 'user', 'email', 'login', 'userid'].some((k) => n.includes(k))
  );
  if (hasPassword && hasUsername && fields.length <= 4) {
    return 'login';
  }

  // Search form detection
  const hasSearch = fieldNames.some((n) =>
    ['search', 'query', 'q', 'keyword', 'term'].some((k) => n.includes(k))
  );
  if (hasSearch && fields.length <= 2) {
    return 'search';
  }

  // Upload form detection
  const hasFile = fieldTypes.includes('file');
  if (hasFile) {
    return 'upload';
  }

  // Contact form detection
  const hasEmail = fieldNames.some((n) => n.includes('email'));
  const hasMessage = fieldNames.some((n) =>
    ['message', 'comment', 'body', 'content'].some((k) => n.includes(k))
  );
  if (hasEmail && hasMessage) {
    return 'contact';
  }

  return 'other';
}
