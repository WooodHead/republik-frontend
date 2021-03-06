import React from 'react'
import { HEADER_HEIGHT } from './constants'
import { Loader, NarrowContainer } from '@project-r/styleguide'

const LoaderWithHeaderHeight = props => (
  <Loader
    ErrorContainer={NarrowContainer}
    {...props}
    style={{ minHeight: ['100vh', `calc(100vh - ${HEADER_HEIGHT}px)`] }}
  />
)

export default LoaderWithHeaderHeight
