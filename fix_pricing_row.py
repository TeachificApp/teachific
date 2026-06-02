content = open('client/src/pages/lms/CourseBuilderPage.tsx').read()

old = """      <button onClick={() => { if (confirm("Delete this pricing option?")) deleteOption.mutate({ id: opt.id }); }} className="text-xs text-red-400 hover:text-red-600 p-1 flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
function CoursePricingOptionsEditor"""

new = """      {opt.stripePaymentLinkUrl && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(opt.stripePaymentLinkUrl as string).then(() => toast.success("Stripe Payment Link copied!"));
          }}
          className="text-xs text-purple-400 hover:text-purple-600 p-1 flex-shrink-0"
          title={`Copy Stripe Payment Link\\n${opt.stripePaymentLinkUrl}`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
      <button onClick={() => { if (confirm("Delete this pricing option?")) deleteOption.mutate({ id: opt.id }); }} className="text-xs text-red-400 hover:text-red-600 p-1 flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
function CoursePricingOptionsEditor"""

if old in content:
    content = content.replace(old, new, 1)
    print('PricingOptionRow Stripe button added successfully')
else:
    print('ERROR: Pattern not found')
    # Print the area around line 8499
    lines = content.split('\n')
    for i, line in enumerate(lines[8495:8510], start=8496):
        print(f'{i}: {repr(line)}')

open('client/src/pages/lms/CourseBuilderPage.tsx', 'w').write(content)
print('File saved')
