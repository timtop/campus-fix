import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusBadge from '../components/StatusBadge.vue'
describe('status badge component', () => {
  it('uses readable text for multiword status', () => { const wrapper = mount(StatusBadge, { props: { status: 'IN_PROGRESS' } }); expect(wrapper.text()).toBe('in progress'); expect(wrapper.classes()).toContain('in_progress') })
  it('updates when a request completes', async () => { const wrapper = mount(StatusBadge, { props: { status: 'OPEN' } }); await wrapper.setProps({ status: 'COMPLETED' }); expect(wrapper.text()).toBe('completed'); expect(wrapper.classes()).not.toContain('open') })
})
