# Color Component Guidelines

When adding color utility classes (e.g., `dark:bg-green-700`, `text-blue-500`) to frontend components, follow these steps to ensure consistency and maintainability:

1. **Check Color Existence in Theme**

   - Before using a color class (e.g., `green-700`), verify that the color is defined in the root theme (usually in your Tailwind or CSS variables configuration).
   - Example: Ensure `--color-green-700` exists in the `:root` or theme section.

2. **Check for Dark Mode Support**

   - If you want to use a dark mode variant (e.g., `dark:bg-green-700`), confirm that the dark mode CSS is present for that color.
   - Example:
     ```css
     .dark\:text-green-700:is(.dark *) {
       color: var(--color-green-700);
     }
     ```
   - If it does not exist, add the appropriate CSS or update the theme configuration.

3. **Add Missing Colors**

   - If the color or its dark variant is missing, update the theme or CSS variables to include it before using the class in the component.

4. **Consistency**

   - Always use theme-defined colors and avoid hardcoding color values directly in components.

5. **Testing**
   - Test the component in both light and dark modes to ensure the color renders as expected.

---

**Example Workflow:**

1. Want to use `dark:bg-green-700` on a button.
2. Check if `--color-green-700` exists in the theme.
3. Check if `.dark\:bg-green-700` is defined in your CSS.
4. If missing, add them to your theme/CSS.
5. Use the class in your component.
6. Test in both modes.
