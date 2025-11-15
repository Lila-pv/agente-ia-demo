import { supabase } from './supabaseClient';

export default function TestComponent() {
  const handleTest = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const message = "Test message";

    console.log('TEST - userId:', userId);
    console.log('TEST - message:', message);

    const payload = JSON.stringify({ message, userId });
    console.log('TEST - payload:', payload);

    const response = await fetch(
      'https://dnwtscjvppnhwzrkbzjo.supabase.co/functions/v1/process_message',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: payload,
      }
    );

    const data = await response.json();
    console.log('TEST - response:', data);
  };

  return (
    <button onClick={handleTest} className="p-4 bg-red-500 text-white rounded">
      Test
    </button>
  );
}