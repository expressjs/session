node {
    service = 'session'
    build.init {}

    stage 'Build'
    compose.build {}

    stage 'Test'
    compose.test {}
}

