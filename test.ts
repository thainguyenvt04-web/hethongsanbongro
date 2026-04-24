import { PayOS } from '@payos/node';
console.log('PayOS named:', PayOS);
try {
  const payos = new PayOS("1", "2", "3");
  console.log('Instance:', payos);
  console.log('Keys:', Object.keys(payos));
  // check if createPaymentLink exists
  console.log('createPaymentLink:', payos.createPaymentLink);
} catch(e) {
  console.error(e);
}
