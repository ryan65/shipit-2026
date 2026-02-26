
const BASE_URL = 'http://51.44.4.67:3000';

async function createTask(name, description) {
  const res = await fetch(`${BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to create task: ${data.error}`);
  return data;
}

async function deleteTask(id) {
  const res = await fetch(`${BASE_URL}/api/tasks/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to delete task ${id}: ${data.error}`);
  return data;
}

async function main() {
  console.log('=== Creating 10 tasks ===');
  const created = [];
  for (let i = 1; i <= 10; i++) {
    const task = await createTask(`Task ${i}`, `Description for task ${i}`);
    console.log(`  [+] Created: id=${task.id} name="${task.name}"`);
    created.push(task);
  }

  console.log('\n=== Deleting first 5 tasks ===');
  const toDelete = created.slice(0, 5);
  for (const task of toDelete) {
    await deleteTask(task.id);
    console.log(`  [-] Deleted: id=${task.id} name="${task.name}"`);
  }

  console.log('\nDone. Created 10 tasks, deleted 5. 5 tasks remaining.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

