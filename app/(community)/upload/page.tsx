import { redirect } from 'next/navigation'

export default function UploadRedirectPage() {
  redirect('/user/citations/submit')
}
